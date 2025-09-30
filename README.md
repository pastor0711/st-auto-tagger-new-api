# SillyTavern Auto Tagger

SillyTavern Auto Tagger is an extension for quick tagging of character cards. It pulls tags and optionally creator info from [Chub.ai](https://www.chub.ai/about).

**✅ Updated for current Chub.ai API** - This extension has been fixed and updated to work with Chub.ai's current API endpoints and authentication system. 

## Features
- Leverages a [Dice Coefficient](https://en.wikibooks.org/wiki/Algorithm_Implementation/Strings/Dice's_coefficient) based matching method that allows the system to identify and match modified cards.
- Seamlessly integrates into the existing tag importing system.
- Provides the option to import the tagline into the creator's notes field.
- **Chub.ai API Integration**: Searches and downloads character data from Chub.ai's current API.
- **Authentication Support**: Optional API token authentication for enhanced search results.

## Authentication Setup (Required for Search)

To use the search functionality, you need to provide your Chub.ai API token:

1. Open [Chub.ai](https://chub.ai) in your browser and log in
2. Press **F12** to open Developer Tools
3. Go to **Application/Storage** tab
4. Click **Local Storage** → **https://chub.ai**
5. Find **URQL_TOKEN** and copy its value (the long string)
6. In SillyTavern, go to **Extensions → Auto Tagger**
7. Paste the token in the **"Chub.ai API Token"** field
8. Save settings

## Installation and Usage

1. Install using SillyTavern's third party extension importer
2. Set up your Chub.ai API token (see Authentication Setup above)
3. Use the extension buttons in the Extensions panel

![image](https://github.com/city-unit/st-auto-tagger/assets/1860540/188b8ba5-c121-4357-96f8-a45bd60cf8a5)

![image](https://github.com/city-unit/st-auto-tagger/assets/140349364/ba3e995e-054a-4d08-a85a-f03afa4bbb5b)


## Prerequisites

- **SillyTavern**: Latest version required
- **Chub.ai Account**: Required for API token (see Authentication Setup above)
- **Browser Access**: Must be able to access Chub.ai to obtain your API token

## Current Status

**✅ FULLY FUNCTIONAL** - The extension has been updated and tested to work with Chub.ai's current API (as of 2025).

**🔧 Recent Fixes:**
- Fixed API endpoints for current Chub.ai gateway
- Added proper authentication token support
- Resolved parameter validation issues
- Improved error handling and logging
- Updated token retrieval instructions

## Troubleshooting

**If search returns no results:**
1. Ensure you have a valid Chub.ai API token set up
2. Check that you're logged into Chub.ai in your browser
3. Verify the token format (should be a UUID-like string)

**If you get 422 errors:**
- The API token might be invalid or expired
- Try getting a fresh token from Chub.ai

**Console errors:**
- Check the browser console for detailed error messages
- The extension provides detailed logging for debugging

## Documentation

The codebase includes docstrings to make it easier to understand the purpose and functionality of individual functions and classes. Please read these docstrings for more information on how to use the different components of this extension.

## Credits

- **Original Author**: [city-unit](https://github.com/city-unit) - Creator of the st-auto-tagger extension
- **Current Maintainer**: [Cenkay/pastor0711](https://github.com/cenkay) - Updated and fixed for current Chub.ai API (2025)

## Support and Contributions

If you encounter any issues while using this extension, please file an issue on GitHub. If you'd like to contribute to this project, feel free to fork the repository and submit a pull request.

## License

SillyTavern Auto Tagger is available under the [MIT License](https://github.com/city-unit/st-auto-tagger/blob/main/LICENSE).
