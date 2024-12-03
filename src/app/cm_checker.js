const puppeteer = require('puppeteer');
const url = require('url');
const fs = require('fs');
const path = require('path');

// Dictionary of tracking services and their identifiers
const dictionary = {
    "Google Analytics 4": ["google-analytics.com/g/collect", "analytics.google.com/g/collect"],
    "Google Ads": "google.com/pagead",
    "Facebook Pixel": "facebook.com/tr",
    "Microsoft Advertising": "bat.bing.com",
    "TikTok Pixel": "analytics.tiktok.com",
    "LinkedIn Insight": "linkedin.com/px",
    "Twitter Pixel": "static.ads-twitter.com",
    "Pinterest Tag": "ct.pinterest.com",
    "Snapchat Pixel": "tr.snapchat.com"
};

// Object to track which vendors were detected
const vendors = {
    "Google Analytics 4": 'false',
    "Google Ads": 'false',
    "Facebook Pixel": 'false',
    "Microsoft Advertising": 'false',
    "TikTok Pixel": 'false',
    "LinkedIn Insight": 'false',
    "Twitter Pixel": 'false',
    "Pinterest Tag": 'false',
    "Snapchat Pixel": 'false'
};

// Helper function for delays
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// Function to get banner selectors based on banner type
function getBannerSelectors(banner) {
    const selectors = {
        "Cookiebot": [
            '#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll',
            '.CybotCookiebotDialogBodyButton[data-accept-all="true"]',
            '#CookiebotWidget .CookiebotWidget-button-accept[data-accept-all="true"]',
            '#CybotCookiebotDialogBodyButtonAccept:not([data-accept-selected])'
        ],
        "Borlabs Cookie": [
            '.brlbs-btn-accept-all'
        ],
        "Usercentrics": [
            'button[data-testid="uc-accept-all-button"]',
            '.usercentrics-button[data-testid="accept-all-button"]'
        ],
        "Pandectes": [
            'button[aria-label="allow cookies"].cc-btn.cc-btn-decision.cc-allow',
            'a.cc-btn.cc-btn-decision.cc-allow'
        ],
        "EU Cookie": [
            '#ws_eu-cookie-container'
        ],
        "Consentmanager": [
            '.cmptxt_btn_yes',
            'button.cmpboxbtnyes',
            'a.cmpboxbtn.cmpboxbtnyes.cmptxt_btn_yes',
            'button[aria-label="Accept all"]'
        ]
    };

    return banner ? selectors[banner] : selectors;
}

// Export the main function to be used by the API route
async function checkWebsite({ website, banner, otherBanner, mode }) {
    // Initialize result object
    let result = {
        message: '',
        website: website,
        banner: banner,
        mode: mode,
        details: [],
        status: 'success'
    };

    // Check if the selected banner is "Other" and if the user has typed a value
    if (banner === 'Other' && otherBanner) {
        result.message = "We do not yet support this banner. Please reach out to us for a manual check!";
        result.status = 'error';
        return result; // Return early with the error message
    }

    try {
        const browser = await puppeteer.launch();
        const page = await browser.newPage();

        let requestsBeforeAccepting = [];
        let requestsAfterAccepting = [];
        let acceptedCookies = false;
        let advancedConsentMode = false;

        // Listen for all network requests
        page.on('request', request => {
            const requestUrl = request.url();
            for (const [key, value] of Object.entries(dictionary)) {
                if (Array.isArray(value) ? value.some(v => requestUrl.includes(v)) : requestUrl.includes(value)) {
                    const parsedUrl = new URL(requestUrl);
                    const gcs = parsedUrl.searchParams.get('gcs');
                    const requestInfo = { url: requestUrl, gcs: gcs, name: key };
                    
                    if (!acceptedCookies) {
                        requestsBeforeAccepting.push(requestInfo);
                    } else {
                        requestsAfterAccepting.push(requestInfo);
                    }
                    vendors[key] = 'true';
                }
            }
        });

        // Navigate to website
        await page.goto(website, { waitUntil: 'networkidle0', timeout: 30000 });
        



        // Wait additional time to ensure all initial requests are captured
        await delay(5000);

        console.log('\nRequests before accepting:');
        let illegalRequestFound = false;
        let onlyG100RequestsFound = true;
        let requestsFoundBeforeAccepting = [];

        if (requestsBeforeAccepting.length > 0) {
            requestsBeforeAccepting.forEach(req => {
                if (mode.toLowerCase() === "google only") {
                    if (req.name === "Google Analytics 4" || req.name === "Google Ads") {
                        console.log(`Found a ${req.name} request${req.gcs ? ` with gcs value: ${req.gcs}` : ''}`);
                        requestsFoundBeforeAccepting.push(`${req.name}${req.gcs ? ` (gcs: ${req.gcs})` : ''}`);
                        if (!req.gcs || req.gcs !== "G100") {      
                            illegalRequestFound = true;
                            onlyG100RequestsFound = false;
                        }
                    }
                } else {
                    console.log(`Found a ${req.name} request${req.gcs ? ` with gcs value: ${req.gcs}` : ''}`);
                    requestsFoundBeforeAccepting.push(`${req.name}${req.gcs ? ` (gcs: ${req.gcs})` : ''}`);
                }
            });
        } else {
            console.log('No relevant requests found before accepting');
        }

        if (onlyG100RequestsFound && requestsFoundBeforeAccepting.length > 0) {
            advancedConsentMode = true;
        } else if (illegalRequestFound) {
            result.message = "WARNING: GA4 or Google Ads detected before consent! This is not legal.";
            result.status = 'error';
            await browser.close();
            return result;
        }

        try {
            const selectors = getBannerSelectors(banner);
            let detectedBanner = null;

            if (typeof selectors === 'object' && !Array.isArray(selectors)) {
                // If banner is not specified, check all selectors
                for (const [bannerName, selectorList] of Object.entries(selectors)) {
                    const found = await page.evaluate((selectors, bannerName) => {
                        if (bannerName === "EUCookie") {
                            const container = document.querySelector(selectors[0]);
                            const hasButtons = container && container.querySelectorAll('button').length > 0;
                            console.log(`EUCookie container found: ${!!container}, has buttons: ${hasButtons}`);
                            return hasButtons;
                        }
                        
                        const elements = selectors.map(selector => {
                            const el = document.querySelector(selector);
                            console.log(`Selector ${selector} found: ${!!el}`);
                            return el;
                        });
                        return elements.some(el => el !== null);
                    }, selectorList, bannerName);

                    console.log(`${bannerName} found:`, found);

                    if (found) {
                        detectedBanner = bannerName;
                        result.banner = detectedBanner;
                        if (bannerName === "EU Cookie") {
                            const buttonText = await page.evaluate((selector) => {
                                const container = document.querySelector(selector);
                                const buttons = container.querySelectorAll('button');
                                if (buttons.length > 0) {
                                    const lastButton = buttons[buttons.length - 1];
                                    lastButton.click();
                                    return lastButton.textContent.trim();
                                }
                                return null;
                            }, selectorList[0]);
                            
                            if (buttonText) {
                                console.log(`Clicked EU Cookie button with text: "${buttonText}"`);
                            } else {
                                console.log('No button found in EU Cookie banner');
                            }
                        } else {
                            await page.evaluate((selectors) => {
                                for (const selector of selectors) {
                                    const acceptAllButton = document.querySelector(selector);
                                    if (acceptAllButton) {
                                        acceptAllButton.click();
                                        return;
                                    }
                                }
                            }, selectorList);
                        }
                        break;
                    }
                }
            } else {
                // If banner is specified, use the provided selectors
                console.log(`\nChecking specific banner (${banner}) selectors:`, selectors);
                
                const found = await page.evaluate((selectors) => {
                    const elements = selectors.map(selector => {
                        const el = document.querySelector(selector);
                        console.log(`Selector ${selector} found: ${!!el}`);
                        return el;
                    });
                    return elements.some(el => el !== null);
                }, selectors);

                console.log(`Specific banner found:`, found);

                if (found) {
                    if (banner === "EU Cookie") {
                        const buttonText = await page.evaluate((selector) => {
                            const container = document.querySelector(selector);
                            const buttons = container.querySelectorAll('button');
                            if (buttons.length > 0) {
                                const lastButton = buttons[buttons.length - 1];
                                lastButton.click();
                                return lastButton.textContent.trim();
                            }
                            return null;
                        }, selectors[0]); // Use the first selector for EU Cookie
                        
                        if (buttonText) {
                            console.log(`Clicked EU Cookie button with text: "${buttonText}"`);
                        } else {
                            console.log('No button found in EU Cookie banner');
                        }
                    } else {
                        await page.evaluate((selectors) => {
                            for (const selector of selectors) {
                                const acceptAllButton = document.querySelector(selector);
                                if (acceptAllButton) {
                                    acceptAllButton.click();
                                    return;
                                }
                            }
                        }, selectors);
                    }
                    detectedBanner = banner;
                }
            }

            if (detectedBanner) {
                console.log(`\nDetected ${detectedBanner} banner`); console.log('Accepted all cookies'); acceptedCookies = true;

                // Wait longer for any new network activity to settle
                await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 10000 }).catch(() => {});

                console.log('\nRequests after accepting:');
                if (requestsAfterAccepting.length > 0) {
                    requestsAfterAccepting.forEach(req => {
                        if (mode.toLowerCase() === "google only") {
                            if (req.name === "Google Analytics 4" || req.name === "Google Ads") {
                                console.log(`Found a ${req.name} request${req.gcs ? ` with gcs value: ${req.gcs}` : ''}`);
                            }
                        } else {
                            console.log(`Found a ${req.name} request${req.gcs ? ` with gcs value: ${req.gcs}` : ''}`);
                        }
                    });
                } else {
                    console.log('No relevant requests found after accepting');
                }

                console.log('\nFinished capturing all requests');
            } else {
                result.message = "We could not find the cookie banner on your website. Please reach out to us for a manual check."
                result.status = 'error';
                await browser.close();
                return result; }
        } catch (error) {
            console.log('Error while detecting or interacting with cookie banner:', error);
            result.message = `Error detecting cookie banner: ${error.message}`;
            result.status = 'error';
        }

        let ga4OrGadsRequestsBeforeAccepting = false;
        let ga4OrGadsRequestsAfterAccepting = false;
        let gcsParameterFound = false;

        if (mode.toLowerCase() === "google only") {
            ga4OrGadsRequestsBeforeAccepting = requestsBeforeAccepting.some(req => 
                (req.name === "Google Analytics 4" || req.name === "Google Ads") && (!req.gcs || req.gcs !== "G100")
            );

            if (ga4OrGadsRequestsBeforeAccepting && !advancedConsentMode) {
                result.message = "WARNING: GA4 or Google Ads has been detected on your page before accepting consent! This is not legal and can lead to fines. Please contact us!";
                result.status = 'error';
                await browser.close();
                return result;
                
                }

            ga4OrGadsRequestsAfterAccepting = requestsAfterAccepting.some(req => 
                req.name === "Google Analytics 4" || req.name === "Google Ads"
            );

            gcsParameterFound = requestsAfterAccepting.some(req => 
                (req.name === "Google Analytics 4" || req.name === "Google Ads") && req.gcs && req.gcs !== "G100"
            );

            console.log("\nConclusion:");
            if (advancedConsentMode) {
                result.message="You are using advanced consent mode. This is legally controversial and can lead to fines. Please contact us!";
            } else if (!ga4OrGadsRequestsAfterAccepting) {
                result.message="No GA4 or Google Ads requests detected after accepting consent. Please check your implementation.";
            } else if (ga4OrGadsRequestsAfterAccepting && !gcsParameterFound) {
                result.message="Tracking starts after consent, but Google Consent Mode doesn't seem to be enabled. Contact us!";
            } else if (ga4OrGadsRequestsAfterAccepting && gcsParameterFound) {
               result.message="Everything works correctly!";
            }
        }

        await browser.close();
        return result;

    } catch (error) {
        result.message = `Error: ${error.message}`;
        result.status = 'error';
        return result;
    }
}

module.exports = { checkWebsite };
