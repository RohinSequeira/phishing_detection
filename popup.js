document.addEventListener('DOMContentLoaded', function() {
    const scanBtn = document.getElementById('scanBtn');
    const results = document.getElementById('results');
    const loading = document.getElementById('loading');
    const riskLevel = document.getElementById('riskLevel');
    const details = document.getElementById('details');
    const errorMessage = document.getElementById('errorMessage');
    const recommendationsList = document.getElementById('recommendationsList');

    scanBtn.addEventListener('click', async () => {
        // Reset UI
        loading.style.display = 'block';
        results.style.display = 'none';
        errorMessage.style.display = 'none';
        scanBtn.disabled = true;

        try {
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

            // Get analysis from content script
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

        // Set risk level and recommendations
        let riskClass, riskText, recommendations;

        if (analysis.highRiskFactors?.length > 0) {
            riskClass = 'high-risk';
            riskText = '🔴 High Risk - Likely Phishing Attempt';
            recommendations = [
                'Do not click any links in this email',
                'Do not download any attachments',
                'Do not reply to this email',
                'Report this email as phishing'
            ];
        } else if (analysis.warnings?.length > 0) {
            riskClass = 'suspicious';
            riskText = '🟡 Suspicious - Exercise Caution';
            recommendations = [
                'Verify the sender through other means',
                'Do not provide sensitive information',
                'When in doubt, contact the company directly'
            ];
        } else {
            riskClass = 'low-risk';
            riskText = '🟢 Low Risk - No Obvious Red Flags';
            recommendations = [
                'Always remain vigilant with email communications',
                'Keep your security software up to date'
            ];
        }

        // Update UI elements
        riskLevel.className = `risk-level ${riskClass}`;
        riskLevel.textContent = riskText;
        recommendationsList.innerHTML = recommendations.map(rec => `<li>${rec}</li>`).join('');

        // Display detected issues
        if (analysis.highRiskFactors?.length > 0 || analysis.warnings?.length > 0) {
            const detailsList = document.createElement('ul');
            detailsList.style.listStyle = 'none';
            detailsList.style.padding = '0';

            function createDetailedItem(item) {
                const li = document.createElement('li');
                li.className = 'detail-item';
                li.style.cssText = 'margin-bottom: 15px; padding: 10px; background-color: #f8f9fa; border-radius: 4px;';

                // Create a list for all suspicious elements
                const suspiciousList = document.createElement('ul');
                suspiciousList.style.cssText = 'list-style: none; padding: 0; margin: 0;';

                // Add reasoning points
                if (item.reason) {
                    const reasonPoints = item.reason.split('. ').filter(point => point.trim());
                    reasonPoints.forEach(point => {
                        const reasonItem = document.createElement('li');
                        reasonItem.style.cssText = 'margin-bottom: 8px;';
                        reasonItem.textContent = `• ${point.trim()}`;
                        suspiciousList.appendChild(reasonItem);
                    });
                }

                // Add suspicious links as separate points
                if (item.links?.length > 0) {
                    item.links.forEach(link => {
                        const linkItem = document.createElement('li');
                        linkItem.style.cssText = 'margin-bottom: 8px;';
                        linkItem.innerHTML = `• Suspicious Link: "${link.text}" (${link.url})`;
                        suspiciousList.appendChild(linkItem);
                    });
                }

                li.appendChild(suspiciousList);
                return li;
            }

            // Add high risk factors and warnings
            [...(analysis.highRiskFactors || []), ...(analysis.warnings || [])].forEach(item => {
                detailsList.appendChild(createDetailedItem(item));
            });

            details.innerHTML = '<h3>Detected Issues:</h3>';
            details.appendChild(detailsList);
        } else {
            details.innerHTML = '<p>No suspicious elements detected.</p>';
        }
    }
}); 