// Handle OAuth authentication and API calls
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "reportPhishing") {
        (async () => {
            try {
                console.log('Starting phishing report process...');
                console.log('Message ID:', request.messageId);
                
                const token = await chrome.identity.getAuthToken({ interactive: true });
                console.log('Got auth token:', token ? 'Yes' : 'No');
                
                if (!token) {
                    throw new Error('Failed to get authentication token');
                }

                // Use the correct API endpoint for reporting phishing
                const apiUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${request.messageId}/trash`;
                console.log('Making API call to:', apiUrl);

                const response = await fetch(apiUrl, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });

                console.log('API Response status:', response.status);
                console.log('API Response status text:', response.statusText);

                if (!response.ok) {
                    const errorText = await response.text();
                    console.error('API Error response:', errorText);
                    throw new Error(`Failed to report phishing: ${response.statusText} (${response.status})`);
                }

                const responseData = await response.json();
                console.log('API Success response:', responseData);

                // Move the email to spam folder
                const spamUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${request.messageId}/modify`;
                const spamResponse = await fetch(spamUrl, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        addLabelIds: ['SPAM'],
                        removeLabelIds: ['INBOX']
                    })
                });

                if (!spamResponse.ok) {
                    console.error('Failed to move email to spam:', await spamResponse.text());
                }

                sendResponse({ success: true });
            } catch (error) {
                console.error('Detailed error reporting phishing:', error);
                sendResponse({ success: false, error: error.message });
            }
        })();
        return true; // Keep the message channel open for async response
    }
});