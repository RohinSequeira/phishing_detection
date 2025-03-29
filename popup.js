const MAX_ITERATIONS = 3;
const SYSTEM_PROMPT = `You are a cybersecurity agent analyzing emails for phishing attempts in iterations. Respond with EXACTLY as the below format:
FUNCTION_CALL: function_name|input

where function_name is one of the following:
1. extractEmailContent - Extracts subject, body, sender, and links from the current email. Accepts no parameters. Returns contents of the email.
2. analyzeEmail - Analyzes Email for phishing indicators. The function accepts the email content as a parameter. Returns results of analysis in the form of highRiskFactors, warnings, contextualAnalysis.
3. updateUIWithResults - Updates the UI with the results of the email analysis. Accepts highRiskFactors, warnings, contextualAnalysis as a parameter. Returns nothing, as the function updates the UI.

DO NOT include multiple responses. Give ONE response at a time. Only return in expected format.`;

//2. FINAL_ANSWER: [analysis_result]

// Add these state variables
let lastResponse = null;
let iteration = 0;
let iterationResponses = [];

// Add this function to handle LLM API calls
async function getLLMResponse(prompt) {
    //console.log('Getting LLM response...');
    const apiKey = window.config?.GEMINI_API_KEY;
    const apiUrl = window.config?.GEMINI_URL;

    //console.log('API Key available:', !!apiKey);
    //console.log('API URL:', apiUrl);

    if (!apiKey || apiKey === 'your_api_key_here') {
        throw new Error('Gemini API key not configured');
    }

    const response = await fetch(`${apiUrl}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }]
        })
    });

    if (!response.ok) {
        throw new Error('LLM API request failed');
    }

    const data = await response.json();
    return data.candidates[0].content.parts[0].text.trim();
}

// Add this function to execute functions based on LLM decisions
async function executeFunction(funcName, params, tabId) {
    try {
        //console.log('Executing function:', funcName);
        switch (funcName) {
            case 'extractEmailContent':
                return await new Promise((resolve) => {
                    chrome.tabs.sendMessage(tabId, { action: "extractEmailContent" }, (response) => {
                        if (chrome.runtime.lastError) {
                            console.error('Error in extractEmailContent:', chrome.runtime.lastError);
                            resolve({ error: chrome.runtime.lastError.message });
                        } else {
                            //console.log('Extracted email content:', response);
                            resolve(response);
                        }
                    });
                });
            case 'analyzeEmail':
                return await new Promise((resolve) => {
                    //console.log('Popup: Sending analyzeEmail request with params:', params);
                    // Parse the params if it's a string
                    const emailContent = typeof params === 'string' ? JSON.parse(params) : params;

                    //console.log('Analyzing email content:', emailContent);

                    if (!emailContent) {
                        console.error('Popup: No email content provided');
                        resolve({ error: 'No email content provided' });
                        return;
                    }
                    chrome.tabs.sendMessage(tabId, { action: "analyzeEmail", emailContent: emailContent}, (response) => {
                        if (chrome.runtime.lastError) {
                            console.error('Error in analyzeEmail:', chrome.runtime.lastError);
                            resolve({ error: chrome.runtime.lastError.message });
                        } else {
                           // console.log('Email analysis result:', response);
                            resolve(response);
                        }
                    });
                });
            case 'updateUIWithResults':
                let analysisObject;
                try {
                    // If params is empty or just whitespace, use empty default object
                    if (!params || params.trim() === '') {
                        analysisObject = { highRiskFactors: [], warnings: [], contextualAnalysis: [] };
                    } else {
                        analysisObject = typeof params === 'string' ? JSON.parse(params) : params;
                    }
                    //console.log('Parsed analysis object:', analysisObject);
                    updateUIWithResults(analysisObject);
                    return { success: true };
                } catch (error) {
                    console.error('Error parsing analysis object:', error);
                    // Use default empty object if parsing fails
                    analysisObject = { highRiskFactors: [], warnings: [], contextualAnalysis: [] };
                    updateUIWithResults(analysisObject);
                    return { success: true };
                }
            default:
                throw new Error(`Unknown function: ${funcName}`);
        }
    } catch (error) {
        console.error('Error executing function:', error);
        throw error;
    }
}

// Add this function to run the LLM agent
async function runAgent(tabId) {
    //console.log('Starting LLM agent...');
    // Reset state
    lastResponse = null;
    iteration = 0;
    iterationResponses = [];

    try {

        while (iteration < MAX_ITERATIONS) {
            console.log(`\n--- Iteration ${iteration + 1} ---`);
            
            // Prepare the current query
            let currentQuery = iteration === 0 ? 
            "Analyze this email for phishing attempts and update the UI with the results." : 
            `Previous results: ${iterationResponses.join(' ')} What should I do next?`;

            console.log('Current query:', currentQuery);

            // Get LLM's response
            const prompt = `${SYSTEM_PROMPT}\n\nQuery: ${currentQuery}`;
            const response = await getLLMResponse(prompt);
            //console.log(`Iteration ${iteration+1} prompt: ${prompt}`);
            console.log('LLM Response:', response);

            // Process the response
            if (response.startsWith('FUNCTION_CALL:')) {
                //const [funcName, params] = response.split('|').map(x => x.trim());
                //const [, functionInfo] = response.split(':');
                //const [funcName, params] = functionInfo.split('|');
                //const trimmedFuncName = funcName.trim();

                const firstColonIndex = response.indexOf(':');
                const functionInfo = response.substring(firstColonIndex + 1);  // Get everything after first ':'
                const [funcName, params] = functionInfo.split('|');
                const trimmedFuncName = funcName.trim();
                
                //console.log('Executing function:', funcName, 'with params:', params);
                //console.log('Function name:', trimmedFuncName);
                //console.log('Full params:', params);
                
                // Execute the function
                const result = await executeFunction(trimmedFuncName, params, tabId);
                console.log('Function Result:', result);

                // Update iteration state
                lastResponse = result;
                iterationResponses.push(
                    `In iteration ${iteration + 1} you called ${trimmedFuncName} with ${params} parameters, and returned ${JSON.stringify(result)}.`
                );
            } 
            //else if (response.startsWith('FINAL_ANSWER:')) {
             //   console.log('\n=== Email Analysis Complete ===');
              //  const finalResult = JSON.parse(response.replace('FINAL_ANSWER:', ''));
               // updateUIWithResults(finalResult);
                //break;
            //}
            else {
                console.warn('Unexpected LLM response format:', response);
            }
            iteration++;
        }
    } catch (error) {
        console.error('iteration ${iteration + 1}:', error);
        throw error;
    }
}

// Move updateUIWithResults function outside DOMContentLoaded
function updateUIWithResults(analysis) {
    const results = document.getElementById('results');
    const riskLevel = document.getElementById('riskLevel');
    const details = document.getElementById('details');
    const recommendationsList = document.getElementById('recommendationsList');
    const reportBtn = document.getElementById('reportBtn');

    results.style.display = 'block';

    // Set risk level and recommendations
    let riskClass, riskText, recommendations;

    //console.log('Full analysis object:', analysis);
    //console.log('Analysis High Risk Factors:', analysis.highRiskFactors);
    //console.log('Analysis Warnings:', analysis.warnings);
    //console.log('High Risk Factors length:', analysis.highRiskFactors?.length);
    //console.log('Warnings length:', analysis.warnings?.length);

    if (analysis.highRiskFactors?.length > 0) {
        riskClass = 'high-risk';
        riskText = '🔴 High Risk - Likely Phishing Attempt';
        recommendations = [
            'Do not click any links in this email',
            'Do not download any attachments',
            'Do not reply to this email',
            'Report this email as phishing'
        ];
        reportBtn.style.display = 'block';
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

document.addEventListener('DOMContentLoaded', function() {
    //console.log('DOMContentLoaded fired');
    const scanBtn = document.getElementById('scanBtn');
    //console.log('Scan button found:', scanBtn);
    const reportBtn = document.getElementById('reportBtn');
    const results = document.getElementById('results');
    const loading = document.getElementById('loading');
    const riskLevel = document.getElementById('riskLevel');
    const details = document.getElementById('details');
    const errorMessage = document.getElementById('errorMessage');
    const successMessage = document.getElementById('successMessage');
    const recommendationsList = document.getElementById('recommendationsList');

    scanBtn.addEventListener('click', async () => {
        console.log('Scan button clicked');
        // Reset UI
        loading.style.display = 'block';
        results.style.display = 'none';
        errorMessage.style.display = 'none';
        successMessage.style.display = 'none';
        reportBtn.style.display = 'none';
        scanBtn.disabled = true;

        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            //console.log('Tab found:', tab.url);
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

            // // Get analysis from content script
            // const response = await new Promise((resolve, reject) => {
            //     chrome.tabs.sendMessage(tab.id, { action: "getEmailContent" }, (response) => {
            //         if (chrome.runtime.lastError) {
            //             reject(new Error(chrome.runtime.lastError.message));
            //             return;
            //         }
            //         if (!response) {
            //             reject(new Error('Empty response from content script'));
            //             return;
            //         }
            //         resolve(response);
            //     });
            // });
            
            // updateUIWithResults(response);
            
            // Run the LLM agent
            //console.log('About to call runAgent');
            await runAgent(tab.id);
            //console.log('runAgent completed');

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

    reportBtn.addEventListener('click', async () => {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            if (!tab.url.includes('mail.google.com')) {
                throw new Error('Phishing reporting is currently only supported for Gmail.');
            }

            reportBtn.disabled = true;
            loading.style.display = 'block';
            errorMessage.style.display = 'none';
            successMessage.style.display = 'none';

            const response = await new Promise((resolve, reject) => {
                chrome.tabs.sendMessage(tab.id, { action: "reportPhishing" }, (response) => {
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

            if (response.success) {
                successMessage.textContent = 'Email successfully reported as phishing!';
                successMessage.style.display = 'block';
            } else {
                throw new Error(response.error || 'Failed to report phishing email');
            }
        } catch (error) {
            console.error('Error:', error);
            errorMessage.textContent = error.message || 'Error reporting phishing email. Please try again.';
            errorMessage.style.display = 'block';
        } finally {
            loading.style.display = 'none';
            reportBtn.disabled = false;
        }
    });

    function updateUIWithResults(analysis) {
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
            reportBtn.style.display = 'block';
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