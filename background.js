// Handle OAuth authentication and API calls
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "reportPhishing") {
        (async () => {
            try {
                console.log('Starting phishing report process...');
                console.log('Message ID:', request.messageId);

                // Validate message ID
                if (!request.messageId || typeof request.messageId !== 'string' || request.messageId.length < 10) {
                    throw new Error('Invalid message ID format');
                }
                
                // Function to handle API calls with token
                async function makeApiCall(url, method, body = null) {
                    let token = null;
                    let retryCount = 0;
                    const maxRetries = 2;
                    let lastError = null;

                    while (retryCount < maxRetries) {
                        try {
                            console.log(`Attempt ${retryCount + 1} of ${maxRetries}`);
                            
                            // Get a fresh token each time
                            console.log('Requesting new auth token...');
                            token = await chrome.identity.getAuthToken({ 
                                interactive: true,
                                scopes: ['https://www.googleapis.com/auth/gmail.modify']
                            });
                            
                            if (!token) {
                                throw new Error('Failed to get authentication token');
                            }

                            console.log('Got auth token successfully');

                            const headers = {
                                'Authorization': `Bearer ${token}`,
                                'Content-Type': 'application/json'
                            };

                            console.log(`Making ${method} request to:`, url);
                            if (body) {
                                console.log('Request body:', body);
                            }

                            const response = await fetch(url, {
                                method: method,
                                headers: headers,
                                body: body ? JSON.stringify(body) : null
                            });

                            console.log(`Response status: ${response.status}`);
                            const responseText = await response.text();
                            console.log('Response body:', responseText);

                            // If unauthorized, try to refresh the token
                            if (response.status === 401) {
                                console.log('Token expired or revoked, refreshing...');
                                // Remove the old token
                                await chrome.identity.removeCachedAuthToken({ token: token.toString() });
                                retryCount++;
                                continue;
                            }

                            // For Gmail API, some successful responses might have non-200 status codes
                            if (response.status === 204 || response.status === 200) {
                                return response;
                            }

                            // Try to parse the error response
                            let errorMessage = `API call failed with status ${response.status}`;
                            try {
                                const errorJson = JSON.parse(responseText);
                                errorMessage += `: ${errorJson.error?.message || responseText}`;
                            } catch (e) {
                                errorMessage += `: ${responseText}`;
                            }
                            throw new Error(errorMessage);
                        } catch (error) {
                            console.error(`API call attempt ${retryCount + 1} failed:`, error);
                            lastError = error;
                            if (token) {
                                try {
                                    await chrome.identity.removeCachedAuthToken({ token: token.toString() });
                                } catch (removeError) {
                                    console.error('Failed to remove cached token:', removeError);
                                }
                            }
                            retryCount++;
                        }
                    }

                    throw new Error(`Failed to make API call after ${maxRetries} attempts. Last error: ${lastError?.message || 'Unknown error'}`);
                }

                // Move email to trash
                const trashUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${request.messageId}/trash`;
                console.log('Making trash API call to:', trashUrl);

                const trashResponse = await makeApiCall(trashUrl, 'POST');
                console.log('Trash API Response status:', trashResponse.status);

                // Move email to spam
                const spamUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${request.messageId}/modify`;
                console.log('Making spam API call to:', spamUrl);

                const spamResponse = await makeApiCall(spamUrl, 'POST', {
                    addLabelIds: ['SPAM'],
                    removeLabelIds: ['INBOX']
                });
                console.log('Spam API Response status:', spamResponse.status);

                sendResponse({ success: true });
            } catch (error) {
                console.error('Detailed error reporting phishing:', error);
                sendResponse({ 
                    success: false, 
                    error: error.message,
                    needsAuth: error.message.includes('Failed to get authentication token')
                });
            }
        })();
        return true; // Keep the message channel open for async response
    }
});