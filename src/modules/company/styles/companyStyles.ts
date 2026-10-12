import { CompanyColors } from '../../../types/styles';
import { Colors } from '../../shared/utils/colors';
import { generateBackgroundCss } from '../../../utils/backgroundCss';

/**
 * Get complete company theme CSS for BBB interface
 * Applies primary and background colors to global variables
 */
export const getCompanyThemeCSS = (companyColors: CompanyColors): string => {
  // Calculate contrast text colors for better visibility
  const primaryTextColor = Colors.getContrastColor(companyColors.primaryColor);

  // For background, use color from solid or gradient.color1 for contrast calculation
  const bgColorForContrast =
    companyColors.background.type === 'solid'
      ? companyColors.background.color || '#06172A'
      : companyColors.background.type === 'gradient'
        ? companyColors.background.gradient?.color1 || '#06172A'
        : '#06172A'; // For images, default to dark
  const secondaryTextColor = Colors.getContrastColor(bgColorForContrast);

  // Generate background CSS
  const backgroundCss = generateBackgroundCss(companyColors.background);

  return `
        /* Global theme variables */
        :root {
            --color-primary: ${companyColors.primaryColor} !important;
            --color-selected: ${companyColors.primaryColor} !important;
            --color-background: ${backgroundCss} !important;
            --btn-primary-hover-bg: ${companyColors.primaryColor} !important;
            --btn-primary-active-bg: ${companyColors.primaryColor} !important;
        }

        /* Base styles */
        body {
            background: ${backgroundCss} !important;
        }

        /* Text color adaptation for better contrast */
        h1[data-test="presentationTitle"] {
            color: ${secondaryTextColor} !important;
        }

        /* Navbar container - prevent isolation but don't blend */
        #Navbar > div,
        #Navbar > div > div {
          isolation: auto !important;
        }

        /* Navbar elements - always visible (excluding connection/leave buttons) */
        #Navbar i.icon-bbb-left_arrow,
        #Navbar button[data-test="toggleUserList"],
        #Navbar button[data-test="toggleUserList"] i.icon-bbb-user,
        #Navbar button[data-test="toggleUserList"] span,
        #Navbar button[data-test="optionsButton"],
        #Navbar button[data-test="optionsButton"] i.icon-bbb-more,
        #Navbar button[data-test="optionsButton"] span,
        #Navbar h1[data-test="presentationTitle"],
        #Navbar h1[data-test="presentationTitle"] span,
        #Navbar h1[data-test="presentationTitle"] i.icon-bbb-device_list_selector {
          color: white !important;
          mix-blend-mode: difference !important;
        }

        /* Text color adaptation for better contrast */
        #ActionsBar button.buttonWrapper span {
          color: ${primaryTextColor} !important;
        }

        /* Text color adaptation for better contrast */
        button[data-test="sendMessageButton"] i.icon-bbb-send {
          color: ${primaryTextColor} !important;
        }

        button[data-test="sendMessageButton"] {
          color: ${primaryTextColor} !important;
        }

        /* Theme overrides */
        .tl-theme__light {
            --color-selected: ${companyColors.primaryColor} !important;
        }

        :root {
          --color-primary: ${companyColors.primaryColor} !important;
          --color-background: ${backgroundCss} !important;
        }
        
        #ActionsBar button.buttonWrapper span {
          background-color: ${companyColors.primaryColor} !important;
        }
        
        /* Logo layout */
        .company-logo-parent {
            display: flex;
            flex-direction: column;
            align-items: start !important;
        }
        
        .company-logo-parent h2[data-test="messageTitle"] {
            align-self: flex-start;
        }
        
        .company-logo {
            margin-bottom: 1rem;
            text-align: center;
            max-width: 300px;
            margin-left: 0.8em;
            background: transparent !important;
        }

        .company-logo img {
            max-width: 100%;
            height: auto;
            background: transparent !important;
        }
    `;
};
