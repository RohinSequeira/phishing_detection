document.addEventListener('DOMContentLoaded', function() {
    const scanBtn = document.getElementById('scanBtn');
    const results = document.getElementById('results');
    const loading = document.getElementById('loading');
    const riskLevel = document.getElementById('riskLevel');
    const details = document.getElementById('details');
    const errorMessage = document.getElementById('errorMessage');
    const warningBadges = document.getElementById('warningBadges');
    const recommendationsList = document.getElementById('recommendationsList');

    scanBtn.addEventListener('click', async () => {
        // Reset UI
        loading.style.display = 'block';
        results.style.display = 'none';
        errorMessage.style.display = 'none';
        scanBtn.disabled = true;

        try {
            // Get the active tab
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            // Check if we're on a supported email domain
            const supportedDomains = [
                'mail.google.com',
                'outlook.live.com',
                'outlook.office.com',
                'mail.yahoo.com'
            ];
            
            const url = new URL(tab.url);
            if (!supportedDomains.includes(url.hostname)) {
                throw new Error('Please open an email in Gmail, Outlook, or Yahoo Mail to scan.');
            }

            // Execute content script
            const response = await new Promise((resolve, reject) => {
                chrome.tabs.sendMessage(tab.id, { action: "getEmailContent" }, (response) => {
                    if (chrome.runtime.lastError) {
                        reject(new Error(chrome.runtime.lastError.message));
                        return;
                    }
                    if (!response) {
                        reject(new Error('Empty response from content script'));
                        return;
                    }
                    resolve(response);
                });
            });

            console.log('Received analysis from content script:', response);
            
            // Update UI with results
            displayResults(response);
        } catch (error) {
            console.error('Error:', error);
            errorMessage.textContent = error.message || 'Error analyzing email. Please try again.';
            errorMessage.style.display = 'block';
            results.style.display = 'none';
        } finally {
            loading.style.display = 'none';
            scanBtn.disabled = false;
        }
    });

    function displayResults(analysis) {
        results.style.display = 'block';
        
        // Reset all badges to inactive
        warningBadges.querySelectorAll('.badge').forEach(badge => {
            badge.classList.remove('active');
        });

        // Determine risk level and set appropriate warnings
        let riskClass = '';
        let riskText = '';
        let recommendations = [];

        if (analysis.highRiskFactors && analysis.highRiskFactors.length > 0) {
            riskClass = 'high-risk';
            riskText = '🔴 High Risk - Likely Phishing Attempt';
            recommendations.push('Do not click any links in this email');
            recommendations.push('Do not download any attachments');
            recommendations.push('Do not reply to this email');
            recommendations.push('Report this email as phishing');
        } else if (analysis.warnings && analysis.warnings.length > 0) {
            riskClass = 'suspicious';
            riskText = '🟡 Suspicious - Exercise Caution';
            recommendations.push('Verify the sender through other means');
            recommendations.push('Do not provide sensitive information');
            recommendations.push('When in doubt, contact the company directly');
        } else {
            riskClass = 'low-risk';
            riskText = '🟢 Low Risk - No Obvious Red Flags';
            recommendations.push('Always remain vigilant with email communications');
            recommendations.push('Keep your security software up to date');
        }

        // Set risk level
        riskLevel.className = `risk-level ${riskClass}`;
        riskLevel.textContent = riskText;

        // Activate relevant warning badges
        if (analysis.warnings) {
            analysis.warnings.forEach(warning => {
                const badge = warningBadges.querySelector(`[data-type="${warning.type}"]`);
                if (badge) {
                    badge.classList.add('active');
                }
            });
        }

        // Display details
        if (analysis.details && analysis.details.length > 0) {
            details.innerHTML = '<h3>Detected Issues:</h3><ul>' +
                analysis.details.map(detail => `<li>${detail}</li>`).join('') +
                '</ul>';
        } else {
            details.innerHTML = '<p>No suspicious elements detected.</p>';
        }

        // Display recommendations
        recommendationsList.innerHTML = recommendations.map(rec => `<li>${rec}</li>`).join('');
    }
}); 