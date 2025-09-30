import { saveSettingsDebounced, getSettings, getRequestHeaders, getCharacters } from "../../../../script.js";
import { extension_settings, getContext, loadExtensionSettings } from "../../../extensions.js";
import { importTags } from "../../../tags.js";

// Extension configuration
const extensionFolderPath = new URL('.', import.meta.url).pathname.replace(/^\//, '');

// Endpoint for API call
// Note: Gateway search endpoint is just /search, download is /api/characters/
const API_ENDPOINT_SEARCH_OLD = "https://api.chub.ai/api/characters/search";
const API_ENDPOINT_SEARCH_GATEWAY = "https://gateway.chub.ai/search";
const API_ENDPOINT_DOWNLOAD = "https://gateway.chub.ai/api/characters/download";

const defaultSettings = {
    useAltDescription: false,
    getCreatorsNote: false,
    findCount: 10,
    diceThreshold: 0.8,
    skipStrategy: 0,
    chubApiToken: '', // Optional Chub.ai authentication token
};

/**
 * Generates and returns a Set of bigrams (pairs of consecutive characters) from a given string.
 * @param {string} str - The string to generate bigrams from.
 * @returns {Set} - A Set object containing all unique bigrams in the string.
 */
function getBigrams(str) {
    const bigrams = new Set();
    for (let i = 0; i < str.length - 1; i += 1) {
        bigrams.add(str.substring(i, i + 2));
    }
    return bigrams;
}

/**
 * Returns a new Set that contains only the elements present in both input Sets.
 * @param {Set} set1 - The first Set.
 * @param {Set} set2 - The second Set.
 * @returns {Set} - A Set containing elements that are common in both input Sets.
 */
function intersect(set1, set2) {
    return new Set([...set1].filter((x) => set2.has(x)));
}

/**
 * Calculates and returns the Dice's coefficient for two strings.
 * Dice's coefficient is a measure of the sets' overlap where 0 means no overlap and 1 means total overlap.
 * @param {string} str1 - The first string to compare.
 * @param {string} str2 - The second string to compare.
 * @returns {number} - Dice's coefficient for the two input strings.
 */
function diceCoefficient(str1, str2) {
    const bigrams1 = getBigrams(str1);
    const bigrams2 = getBigrams(str2);
    return (2 * intersect(bigrams1, bigrams2).size) / (bigrams1.size + bigrams2.size);
}

/**
 * Loads the settings for the tag importer extension.
 * If the settings haven't been initialized yet, they are set to default.
 * Then, the settings are used to set the properties of HTML elements with ids 'use_alt_desc' and 'get_creators_notes'.
 */
async function loadSettings() {
    //Create the settings if they don't exist
    extension_settings.tag_importer = extension_settings.tag_importer || {};
    if (Object.keys(extension_settings.tag_importer).length === 0) {
        Object.assign(extension_settings.tag_importer, defaultSettings);
    }
    $("#use_alt_desc").prop("checked", extension_settings.tag_importer.useAltDescription).trigger("input");
    $("#get_creators_notes").prop("checked", extension_settings.tag_importer.getCreatorsNote).trigger("input");
    $("#find_count").val(extension_settings.tag_importer.findCount).trigger("input");
    $("#dice_threshold").val(extension_settings.tag_importer.diceThreshold).trigger("input");
    $("#skip_strategy").val(extension_settings.tag_importer.skipStrategy);
    $("#chub_api_token").val(extension_settings.tag_importer.chubApiToken || '');
}

/**
 * Updates the 'useAltDescription' setting in the extension settings based on the checkbox's state.
 * This function is designed to be used as an event handler for an input event on a checkbox.
 * After the setting is updated, the settings are saved (debounced).
 */
function onAltDescriptionInput() {
    const value = Boolean($(this).prop("checked"));
    extension_settings.tag_importer.useAltDescription = value;
    saveSettingsDebounced();
}

/**
 * Updates the 'getCreatorsNote' setting in the extension settings based on the checkbox's state.
 * This function is designed to be used as an event handler for an input event on a checkbox.
 * After the setting is updated, the settings are saved (debounced).
 */
function onGetCreatorsNotesInput() {
    const value = Boolean($(this).prop("checked"));
    extension_settings.tag_importer.getCreatorsNote = value;
    saveSettingsDebounced();
}

function onFindCountInput() {
    const value = $(this).val();
    extension_settings.tag_importer.findCount = value;
    $("#find_count_value").text(value);
    saveSettingsDebounced();
}

function onDiceThresholdInput() {
    const value = $(this).val();
    extension_settings.tag_importer.diceThreshold = value;
    $("#dice_threshold_value").text(value);
    saveSettingsDebounced();
}

function onSkipStratInput() {
    console.log("skip strat input");
    console.log($(this).val());
    const value = $(this).val();
    extension_settings.tag_importer.skipStrategy = value;
    saveSettingsDebounced();
}

function onChubApiTokenInput() {
    const value = $(this).val().trim();
    extension_settings.tag_importer.chubApiToken = value;
    saveSettingsDebounced();
    if (value) {
        console.log("Chub.ai API token set successfully");
    } else {
        console.log("Chub.ai API token cleared");
    }
}

/**
 * Toggles the visibility of collapsible content sections
 * @param {string} sectionId - The ID of the collapsible section
 */
function toggleCollapsible(sectionId) {
    const content = $(`#${sectionId}`);
    const header = $(`.collapsible-header[onclick="toggleCollapsible('${sectionId}')"]`);
    const icon = header.find('.collapsible-icon');

    if (content.is(':visible')) {
        content.css('max-height', content.outerHeight() + 'px');
        // Force reflow to ensure max-height is applied before transitioning
        content[0].offsetHeight;
        content.css({
            'max-height': '0px',
            'opacity': '0'
        });
        icon.css('transform', 'rotate(-90deg)');
        setTimeout(() => {
            content.css('display', 'none');
        }, 250);
    } else {
        content.css('display', 'block');
        const scrollHeight = content[0].scrollHeight;
        content.css({
            'max-height': '0px',
            'opacity': '0'
        });
        // Force reflow
        content[0].offsetHeight;
        content.css({
            'max-height': scrollHeight + 'px',
            'opacity': '1'
        });
        icon.css('transform', 'rotate(0deg)');
        setTimeout(() => {
            content.css('max-height', 'none');
        }, 250);
    }
}

/**
 * Fetch character data from the API based on name and description.
 *
 * This function attempts to search for character data using multiple API endpoints.
 * It tries the old api.chub.ai endpoint first, then falls back to gateway.chub.ai if needed.
 * The function searches for both the name and the first 40 characters of the description.
 * If both searches return results, the function combines the results into a single array.
 *
 * @param {string} name - The name of the character to search for.
 * @param {string} description - The description of the character to search for.
 * @returns {Promise<Object[]>} - A Promise that resolves to an array of character data objects.
 */
async function fetchCharacterData(name, description) {
    let data = [];
    
    // Use the new gateway API with complete parameters from chub.ai website
    try {
        console.log(`Searching for character: ${name}`);
        
        // Build search URL with valid parameters only
        const searchParams = new URLSearchParams({
            first: extension_settings.tag_importer.findCount,
            page: 1,
            namespace: 'characters',
            search: name,
            include_forks: true,
            nsfw: true,
            nsfw_only: false,
            require_custom_prompt: false,
            require_example_dialogues: false,
            require_images: false,
            require_expressions: false,
            nsfl: true,
            asc: false,
            min_ai_rating: 0,
            min_tokens: 50,
            max_tokens: 100000,
            chub: true,
            require_lore: false,
            require_lore_embedded: false,
            require_lore_linked: false,
            sort: 'default',
            min_tags: 0,
            inclusive_or: false,
            recommended_verified: false,
            require_alternate_greetings: false,
            count: false,
        });
        
        // Build headers with optional authentication
        const headers = {
            "Accept": "application/json",
        };
        
        // Add authentication if token is provided
        if (extension_settings.tag_importer.chubApiToken) {
            // Try different header formats - different APIs use different conventions
            headers["Authorization"] = `Bearer ${extension_settings.tag_importer.chubApiToken}`;
            console.log(`🔐 Authenticating with token: ${extension_settings.tag_importer.chubApiToken.substring(0, 8)}...`);
        } else {
            console.log("⚠️ No auth token provided - search results may be limited");
        }
        
        let name_response = await fetch(`${API_ENDPOINT_SEARCH_GATEWAY}?${searchParams.toString()}`, {
            method: "GET",
            headers: headers,
            credentials: "omit", // Always omit - token is sent in headers instead
        });

        if (name_response.ok) {
            let name_result = await name_response.json();
            // Gateway API returns { data: { nodes: [...] } }
            let name_data = name_result.data || name_result;
            
            console.log(`Name search returned ${name_data.nodes?.length || 0} results`);
            
            // Log if we got authenticated results
            if (extension_settings.tag_importer.chubApiToken && name_data.nodes?.length > 0) {
                console.log("✅ Authentication successful - receiving search results");
            }
            
            // Search for the first 40 characters of the description
            description = description.substring(0, 40);
            const descParams = new URLSearchParams({
                first: extension_settings.tag_importer.findCount,
                page: 1,
                namespace: 'characters',
                search: description,
                include_forks: true,
                nsfw: true,
                nsfw_only: false,
                require_custom_prompt: false,
                require_example_dialogues: false,
                require_images: false,
                require_expressions: false,
                nsfl: true,
                asc: false,
                min_ai_rating: 0,
                min_tokens: 50,
                max_tokens: 100000,
                chub: true,
                require_lore: false,
                require_lore_embedded: false,
                require_lore_linked: false,
                sort: 'default',
                min_tags: 0,
                inclusive_or: false,
                recommended_verified: false,
                require_alternate_greetings: false,
                count: false,
            });
            
            // Reuse the same headers with authentication
            let char_response = await fetch(`${API_ENDPOINT_SEARCH_GATEWAY}?${descParams.toString()}`, {
                method: "GET",
                headers: headers, // Use the same headers as name search
                credentials: "omit", // Always omit - token is sent in headers instead
            });
            let char_result = char_response.ok ? await char_response.json() : { data: { nodes: [] } };
            // Gateway API returns { data: { nodes: [...] } }
            let char_data = char_result.data || char_result;
            
            console.log(`Description search returned ${char_data.nodes?.length || 0} results`);

            if (name_data.nodes?.length > 0 && char_data.nodes?.length > 0) {
                data = [...name_data.nodes, ...char_data.nodes];
            } else if (name_data.nodes?.length > 0) {
                data = name_data.nodes;
            } else if (char_data.nodes?.length > 0) {
                data = char_data.nodes;
            }
            
            console.log(`✅ Search successful! Found ${data.length} potential matches (combined from both searches)`);
        } else {
            // Log detailed error information
            const errorText = await name_response.text();
            console.error(`Search API returned ${name_response.status}: ${name_response.statusText}`);
            console.error(`Response body:`, errorText);
            
            if (name_response.status === 422) {
                console.error("⚠️ 422 Error - Possible causes:");
                console.error("1. Token might be invalid or expired");
                console.error("2. API might not accept authentication from localhost");
                console.error("3. Wrong authentication header format");
                console.error("Headers sent:", headers);
            }
            
            toastr.warning(`Search returned ${name_response.status} error. Check console for details.`);
        }
    } catch (error) {
        console.error("Character search failed:", error);
        toastr.error("Failed to search Chub.ai. Check console for details.");
    }
    
    return data;
}

/**
 * Fallback function to download a character file from an alternative server.
 *
 * This function sends a GET request to the alternative server to download a character file.
 * The function expects a full path to the character file, which is used to identify the file on the server.
 * The function returns a Promise that resolves to the downloaded character data.
 *
 * @param {string} fullPath - The full path to the character file on the server.
 * @returns {Promise<Object>} - A Promise that resolves to the downloaded character data.
 */
async function downloadCharacterFallback(fullPath) {
    const url = `https://gateway.chub.ai/api/characters/${fullPath}?full=true`;

    console.log(`Downloading character from: ${url}`);
    
    const response = await fetch(url, {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
        },
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch character from gateway: ${response.statusText}`);
    }

    const data = await response.json();
    console.log("Raw API response:", data);
    
    // Map the data to the expected format based on the actual gateway API response structure
    // Response structure: { node: { definition: {...}, description: "...", topics: [...] } }
    const mappedData = {
        definition: data.node?.definition?.example_dialogs || '',
        greeting: data.node?.definition?.first_message || '',
        title: data.node?.definition?.personality || data.node?.name || '',
        description: data.node?.description || data.node?.definition?.description || '',
        personality: data.node?.definition?.personality || '',
        // IMPORTANT: Include topics for tag import
        topics: data.node?.topics || [],
        fullPath: data.node?.fullPath || fullPath,
        name: data.node?.name || '',
    };
    
    console.log("Mapped character data:", mappedData);
    console.log(`Found ${mappedData.topics.length} topics/tags:`, mappedData.topics);
    return mappedData;
}



/**
 * Download a character file from the server.
 *
 * This function sends a POST request to the server to download a character file in the specified format.
 * The function expects a full path to the character file, which is used to identify the file on the server.
 * The function returns a Promise that resolves to the downloaded character data.
 *
 * @param {string} fullPath - The full path to the character file on the server.
 * @returns {Promise<Object>} - A Promise that resolves to the downloaded character data.
 */
async function downloadCharacter(fullPath) {
    // Gateway API doesn't support POST /download, so use GET with fullPath directly
    return downloadCharacterFallback(fullPath);
}


/**
 * Add tags to a character and update the UI and internal map.
 *
 * This function takes a character object and an array of tag names to add to the character.
 * If a tag with the specified name does not exist, a new tag is created. The function then
 * adds the tag to the UI and internal map, and saves the updated settings. Finally, the function
 * prints the updated tags to the console.
 *
 * @param {Object} character - The character object to add tags to.
 * @param {string[]} tagsToAdd - An array of tag names to add to the character.
 * @returns {boolean} - Returns false to keep the input clear.
 */ function filterTopics(topics) {
    return topics.filter((topic) => topic !== "ROOT" && topic !== "TAVERN");
}

/**
 * Fetches and processes character data when the button is clicked.
 * This function also logs any errors that occur during the execution.
 * A notification is displayed to indicate the processing status, and after the processing is completed, the characters' settings and data are fetched again.
 * @param {string} importType The type of import, either "single" or "all".
 */
async function onCImportButtonClick(importType = "all") {
    console.debug("Comparing characters...");
    toastr.info("This may take some time, depending on the number of cards", "Processing...");
    console.log(importType);
    let characters = [];
    if (importType !== "single") {
        characters = await getContext().characters;
    } else {
        const currentChar = await getContext().characters[getContext().characterId];
        if (!currentChar) {
            toastr.error("No character selected");
            console.error("No character selected");
            return;
        }
        characters = [currentChar];
    }

    let importCreatorInfo = extension_settings.tag_importer.getCreatorsNote;
    let useAltDescription = extension_settings.tag_importer.useAltDescription;

    try {
        for (let character of characters) {
            // Skip if character is undefined
            if (!character) {
                console.warn("Skipping undefined character");
                continue;
            }
            
            // If the character already has a creator, tags, or creator notes, skip it
            if (
                extension_settings.tag_importer.skipStrategy == 0 &&
                (character.tags || (importCreatorInfo && (character.creator || character.creatorcomment)))
            ) {
                console.debug(`Skipping ${character.name} because it already has info.`);
                continue;
            }

            const searchedCharacters = await fetchCharacterData(character.name, character.description);
            let found = false;
            for (let searchedCharacterKey in searchedCharacters) {
                let searchedCharacter = searchedCharacters[searchedCharacterKey];
                found = await processCharacter(searchedCharacter, character, importCreatorInfo, useAltDescription);
                if (found) {
                    break;
                }
            }
            if (!found) {
                console.log(`No match found for ${character.name} - searched ${searchedCharacters.length} characters`);
                if (searchedCharacters.length === 0) {
                    toastr.warning(
                        `Character search returned no results. The Chub.ai search API may be temporarily unavailable.`,
                        `No match for ${character.name}`
                    );
                } else {
                    toastr.warning(`Searched ${searchedCharacters.length} characters but found no match`, `No match for ${character.name}`);
                }
            }
        }
    } catch (error) {
        toastr.error("Something went wrong while importing from CHub");
        console.error(`An error occurred while processing characters: ${error}`);
    }
    toastr.success(`Import complete`, `All characters processed`);
}

/**
 * Processes a single character, comparing various attributes and potentially importing data.
 * @param {Object} searchedCharacter - The character found in the search.
 * @param {Object} character - The original character to compare with.
 * @param {boolean} importCreatorInfo - Flag indicating whether creator info should be imported.
 * @param {boolean} useAltDescription - Flag indicating whether to use an alternate description.
 * @returns {boolean} - A boolean indicating if the character data import was successful.
 */
async function processCharacter(searchedCharacter, character, importCreatorInfo, useAltDescription) {
    try {
        const downloadedCharacter = await downloadCharacter(searchedCharacter.fullPath || "");
        const author = getAuthorFromPath(searchedCharacter.fullPath || "");

        const isAuthorMatch = character.creator?.includes(author);
        const isPersonalityMatch = isMatch(character.personality || "", downloadedCharacter.title || "");
        const isDescriptionMatch = isMatch(character.description || "", downloadedCharacter.description || "");
        const fallbackDescriptionMatch = isMatch(character.description || "", downloadedCharacter.personality || "");
        const isScenarioMatch = isMatch(
            (character.mes_example || "").replace(/(\r\n|\n|\r)/gm, ""),
            (downloadedCharacter.definition || "").replace(/(\r\n|\n|\r)/gm, "")
        );
        const isGreetingMatch = isMatch(character.first_mes || "", downloadedCharacter.greeting || "");

        if (checkMatch([isPersonalityMatch, isDescriptionMatch, isScenarioMatch, isGreetingMatch, isAuthorMatch, fallbackDescriptionMatch])) {
            // Use topics from downloaded character since it has the full data including topics
            const characterDataWithTopics = {
                ...searchedCharacter,
                topics: downloadedCharacter.topics || searchedCharacter.topics || [],
                fullPath: downloadedCharacter.fullPath || searchedCharacter.fullPath || "",
            };
            
            await importData(
                character,
                characterDataWithTopics,
                importCreatorInfo,
                author,
                useAltDescription ? (searchedCharacter.tagline || "") : (downloadedCharacter.description || "")
            );
            return true;
        } else {
            console.debug(`Character ${character.name} does not match.`);
        }
    } catch (error) {
        console.error(`Error processing character ${character.name}:`, error);
    }
    return false;
}


/**
 * Compares two strings using the Dice Coefficient.
 * @param {string} a - First string to compare.
 * @param {string} b - Second string to compare.
 * @return {boolean} True if the coefficient is greater than 0.8, false otherwise.
 */
function isMatch(a, b) {
    // If either string is empty, return false
    if (!a || !b) {
        return false;
    }
    //console.log(a, b);
    return diceCoefficient(a, b) > extension_settings.tag_importer.diceThreshold;
}

/**
 * Checks if the number of true values in an array exceeds a threshold.
 * @param {Array.<boolean>} matches - An array of boolean values.
 * @return {boolean} True if there are 2 or more true values in the array, false otherwise.
 */
function checkMatch(matches) {
    return matches.filter((value) => value === true).length >= 2;
}

/**
 * Imports data for a single character, including tags and potentially creator info.
 * @param {Object} character - The original character to update.
 * @param {Object} searchedCharacter - The character found in the search.
 * @param {boolean} importCreatorInfo - Flag indicating whether creator info should be imported.
 * @param {string} author - The author of the searched character.
 * @param {string} description - The description of the downloaded character.
 */
async function importData(character, searchedCharacter, importCreatorInfo, author, description) {
    let tags = filterTopics(searchedCharacter.topics);
    character.tags = addTags(character.tags, tags);
    console.debug(`Importing ${tags.length} tags for ${character.name}.`);
    await importTags(character);

    if (importCreatorInfo) {
        console.debug(`Importing creator info for ${character.name}.`);
        // If in append mode, append creator info to existing creator info
        if (extension_settings.tag_importer.skipStrategy == 1) {
            console.log("appending creator info");
            author = character.creator ? character.creator + "\n" + author : author;
            description = character.data?.creator_notes
                ? character.data.creator_notes + "\n" + description
                : description;
        }

        // Add try catch here, continue if error
        try {
            await editCharacterAttribute(author, "creator", character.avatar, character.name);
            await editCharacterAttribute(description, "creator_notes", character.avatar, character.name);
        } catch (error) {
            toastr.error(`Something went wrong while importing creator info for ${character.name}`);
            console.error(`An error occurred while importing creator info for ${character.name}: ${error}`);
        }

        await getCharacters();
        $("#creator_textarea").val(character.data?.creator);
        $("#creator_notes_textarea").val(character.data?.creator_notes || character.creatorcomment);
    }
    toastr.success(
        `${importCreatorInfo ? "Creator info and " : ""}${tags.length} tags imported`,
        `Import for ${character.name} complete`
    );
}

/**
 * Adds new tags to an array of existing tags, avoiding duplicates.
 * @param {Array.<string>} characterTags - The existing tags.
 * @param {Array.<string>} newTags - The new tags to add.
 * @return {Array.<string>} The updated array of tags.
 */
function addTags(characterTags, newTags) {
    if (!characterTags) {
        characterTags = [];
    }

    for (let tag of newTags) {
        if (!characterTags.includes(tag)) {
            characterTags.push(tag);
            console.log(`Adding tag ${tag}.`);
        }
    }

    return characterTags;
}

/**
 * Sends a POST request to the "/editcharacterattribute" endpoint to edit a specific character attribute.
 * @param {string} value - The new value for the attribute.
 * @param {string} field - The name of the attribute to edit.
 * @param {string} avatar_url - The URL of the character's avatar.
 * @param {string} ch_name - The name of the character.
 */
async function editCharacterAttribute(value, field, avatar_url, ch_name) {
    if (value) {
        const headers = getRequestHeaders();
        const response = await fetch("/editcharacterattribute", {
            method: "POST",
            headers: headers,
            body: JSON.stringify({
                field: field,
                value: value,
                avatar_url: avatar_url,
                ch_name: ch_name,
            }),
        });
        if (response.ok) {
            console.log(`Imported ${field} for ${ch_name}.`);
        }
    }
}

/**
 * Extracts the author's name from a file path.
 * @param {string} fullPath - The full path of the file.
 * @return {string} The author's name.
 */
function getAuthorFromPath(fullPath) {
    return fullPath.split("/")[0];
}

jQuery(async () => {
    const settingsHtml = await $.get(`${extensionFolderPath}dropdown.html`);
    // Append settingsHtml to extensions_settings
    $("#extensions_settings2").append(settingsHtml);
    $("#chub-import").on("click", function () {
        onCImportButtonClick("all");
    });
    $("#chub-import-single").on("click", function () {
        onCImportButtonClick("single");
    });
    $("#use_alt_desc").on("input", onAltDescriptionInput);
    $("#get_creators_notes").on("input", onGetCreatorsNotesInput);
    $("#find_count").on("input", onFindCountInput);
    $("#dice_threshold").on("input", onDiceThresholdInput);
    $("#skip_strategy").on("change", onSkipStratInput);
    $("#chub_api_token").on("input", onChubApiTokenInput);
    loadSettings();

    // Make toggleCollapsible function globally available
    window.toggleCollapsible = toggleCollapsible;
});
