import { useEffect, useRef, useState, useCallback } from 'react';
import { DOMStyleService } from '../../../services/DOMStyleService';
import { FaviconService } from '../../../services/FaviconService';
import { ThemeService } from '../../../services/ThemeService';
import { getCompanyThemeCSS } from '../styles/companyStyles';
import { generateBackgroundStyle } from '../../../utils/backgroundCss';
import { Colors } from '../../shared/utils/colors';

/**
 * Hook to apply company theme and logo to BBB interface
 * Manages both theme application and logo insertion
 */
export const useCompanyTheme = () => {
  const styleId = useRef('company-theme-styles');
  const [isThemeReady, setIsThemeReady] = useState(false);
  const [companyColors, setCompanyColors] = useState(ThemeService.getCompanyColors());

  // For background, use color from solid or gradient.color1 for contrast calculation
  const bgColorForContrast =
    companyColors.background.type === 'solid'
      ? companyColors.background.color || '#06172A'
      : companyColors.background.type === 'gradient'
        ? companyColors.background.gradient?.color1 || '#06172A'
        : '#06172A'; // For images, default to dark
  const secondaryTextColor = Colors.getContrastColor(bgColorForContrast);

  // Function to update button colors based on its state
  const updateButtonColors = useCallback(() => {
    const button = document.querySelector('.sc-ewBhFl');
    if (!button) return;

    const isRecording = button.classList.contains('gztKnR');
    const color = isRecording ? '#ffffff' : secondaryTextColor;

    // Update SVG circles - more specific targeting
    const circles = button.querySelectorAll('svg g circle');
    circles.forEach((circle) => {
      circle.setAttribute('stroke', color);
      if (circle.getAttribute('r') === '4') {
        circle.setAttribute('fill', color);
      }
    });

    // Update text color - target all text elements
    const textElements = button.querySelectorAll('.sc-bCrHVQ, .sc-gZnPbQ, span');
    textElements.forEach((element) => {
      (element as HTMLElement).style.setProperty('color', color, 'important');
    });

    // Also update the main button text container
    const mainTextContainer = button.querySelector('.sc-bCrHVQ.fNqMaU');
    if (mainTextContainer) {
      (mainTextContainer as HTMLElement).style.setProperty('color', color, 'important');
    }
  }, [secondaryTextColor]);

  // Wait for theme service to be ready and get colors
  useEffect(() => {
    const initializeTheme = async () => {
      try {
        // Ensure theme service is initialized
        if (!ThemeService.isInitialized()) {
          await ThemeService.initialize();
        }

        // Get fresh company colors
        const colors = ThemeService.getCompanyColors();
        setCompanyColors(colors);
        setIsThemeReady(true);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Failed to initialize theme:', error);
        setIsThemeReady(true); // Still set as ready to prevent infinite loading
      }
    };

    initializeTheme();
  }, []);

  // Apply company theme styles
  useEffect(() => {
    if (!isThemeReady) return;

    const currentStyleId = styleId.current;
    const css = getCompanyThemeCSS(companyColors);
    DOMStyleService.createStyleSheet(currentStyleId, css);

    // Force apply background to #layout via inline style
    const backgroundStyle = generateBackgroundStyle(companyColors.background);
    const applyBackground = () => {
      const layoutElement = document.getElementById('layout');
      if (layoutElement) {
        // Apply all background properties
        if (backgroundStyle.background) {
          layoutElement.style.setProperty('background', backgroundStyle.background, 'important');
        }
        if (backgroundStyle.backgroundSize) {
          layoutElement.style.setProperty(
            'background-size',
            backgroundStyle.backgroundSize,
            'important',
          );
        }
        if (backgroundStyle.backgroundRepeat) {
          layoutElement.style.setProperty(
            'background-repeat',
            backgroundStyle.backgroundRepeat,
            'important',
          );
        }
        if (backgroundStyle.backgroundPosition) {
          layoutElement.style.setProperty(
            'background-position',
            backgroundStyle.backgroundPosition,
            'important',
          );
        }
      } else {
        // Retry if layout not found yet
        setTimeout(applyBackground, 100);
      }
    };
    applyBackground();

    return () => {
      DOMStyleService.removeStyleSheet(currentStyleId);
      // Reset layout background
      const layoutElement = document.getElementById('layout');
      if (layoutElement) {
        layoutElement.style.removeProperty('background');
        layoutElement.style.removeProperty('background-size');
        layoutElement.style.removeProperty('background-repeat');
        layoutElement.style.removeProperty('background-position');
      }
    };
  }, [companyColors, isThemeReady]);

  // Apply invert filter to navbar icons and text for visibility on all backgrounds
  useEffect(() => {
    if (!isThemeReady) return;

    const applyInvertFilter = () => {
      // First, remove isolation from navbar parents to allow blend mode to work
      const navbarParents = document.querySelectorAll('#Navbar > div, #Navbar > div > div');
      navbarParents.forEach((el) => {
        (el as HTMLElement).style.setProperty('isolation', 'auto', 'important');
      });

      // Selectors for navbar elements that need visibility (excluding connection/leave buttons)
      const navbarSelectors = [
        // Icons (only specific ones, not logout)
        '#Navbar i.icon-bbb-left_arrow',
        '#Navbar button[data-test="toggleUserList"] i.icon-bbb-user',
        '#Navbar button[data-test="optionsButton"] i.icon-bbb-more',
        '#Navbar h1[data-test="presentationTitle"] i.icon-bbb-device_list_selector',
        // Text spans (only for specific buttons)
        '#Navbar button[data-test="toggleUserList"] span',
        '#Navbar button[data-test="optionsButton"] span',
        // Presentation title
        '#Navbar h1[data-test="presentationTitle"]',
        '#Navbar h1[data-test="presentationTitle"] span',
        // Buttons themselves (only toggleUserList and optionsButton)
        '#Navbar button[data-test="toggleUserList"]',
        '#Navbar button[data-test="optionsButton"]',
      ];

      let allFound = true;

      // Apply to all navbar elements - use mix-blend-mode for background-aware contrast
      navbarSelectors.forEach((selector) => {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          elements.forEach((el) => {
            (el as HTMLElement).style.setProperty('color', '#ffffff', 'important');
            (el as HTMLElement).style.setProperty('mix-blend-mode', 'difference', 'important');
          });
        } else {
          allFound = false;
        }
      });

      // Retry if not all elements found
      if (!allFound) {
        setTimeout(applyInvertFilter, 100);
      }
    };

    // Start applying filters
    applyInvertFilter();

    // Also observe DOM changes to reapply if elements are recreated
    const observer = new MutationObserver(() => {
      applyInvertFilter();
    });

    const navbar = document.getElementById('Navbar');
    if (navbar) {
      observer.observe(navbar, {
        childList: true,
        subtree: true,
      });
    }

    return () => {
      observer.disconnect();
    };
  }, [isThemeReady]);

  // Handle button color changes and logo insertion
  useEffect(() => {
    if (!isThemeReady) return;

    let buttonObserver: MutationObserver | null = null;

    const setupButtonObserver = () => {
      const button = document.querySelector('.sc-ewBhFl');
      if (button) {
        // Initial color update
        updateButtonColors();

        // Create observer for class changes
        buttonObserver = new MutationObserver((mutations) => {
          mutations.forEach((mutation) => {
            if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
              updateButtonColors();
            }
          });
        });

        buttonObserver.observe(button, {
          attributes: true,
          attributeFilter: ['class'],
        });
      } else {
        // Button not found, retry after a delay
        setTimeout(setupButtonObserver, 100);
      }
    };

    // Start button observer setup
    setupButtonObserver();

    // Handle logo insertion
    if (companyColors.logo) {
      let retryCount = 0;
      const maxRetries = 30;

      const insertLogo = () => {
        // Check if logo already exists to prevent duplicates
        const existingLogo = document.querySelector('.company-logo');
        if (existingLogo) {
          return;
        }

        // Primary target: messageTitle
        const messageTitle = document.querySelector('h2[data-test="messageTitle"]');

        if (messageTitle) {
          const parentElement = messageTitle.parentElement;
          if (parentElement) {
            parentElement.classList.add('company-logo-parent');

            const logoContainer = document.createElement('div');
            logoContainer.className = 'company-logo';

            const logoImg = document.createElement('img');
            logoImg.src = companyColors.logo ?? '';
            logoImg.alt = 'Company Logo';
            logoImg.style.maxHeight = '80px';
            logoImg.style.maxWidth = '300px';
            logoImg.style.objectFit = 'contain';
            logoImg.style.background = 'transparent';

            logoContainer.appendChild(logoImg);
            messageTitle.parentNode?.insertBefore(logoContainer, messageTitle);
            return;
          }
        }

        // Fallback: try to insert above header chatTitle
        const chatHeader = document.querySelector('header[data-test="chatTitle"]');

        if (chatHeader) {
          const parentElement = chatHeader.parentElement;

          if (parentElement) {
            // Force padding-top using setProperty with !important
            parentElement.style.setProperty('padding-top', '0px', 'important');

            const logoContainer = document.createElement('div');
            logoContainer.className = 'company-logo';
            logoContainer.style.textAlign = 'left';
            logoContainer.style.padding = '10px';

            // Force margin-bottom using setProperty with !important
            logoContainer.style.setProperty('padding-bottom', '0px', 'important');
            logoContainer.style.setProperty('margin', 'unset', 'important');

            const logoImg = document.createElement('img');
            logoImg.src = companyColors.logo ?? '';
            logoImg.alt = 'Company Logo';
            logoImg.style.maxHeight = '80px';
            logoImg.style.maxWidth = '300px';
            logoImg.style.objectFit = 'contain';
            logoImg.style.background = 'transparent';

            logoContainer.appendChild(logoImg);
            chatHeader.parentNode?.insertBefore(logoContainer, chatHeader);
            return;
          }
        }

        // Neither element found or no parent, retry if we haven't exceeded max retries
        retryCount++;
        if (retryCount < maxRetries) {
          setTimeout(insertLogo, 100);
        } else {
          // eslint-disable-next-line no-console
          console.warn('Max retries reached, could not insert logo');
        }
      };

      // Use an interval to continuously check for logo insertion
      const logoCheckInterval = setInterval(() => {
        const existingLogo = document.querySelector('.company-logo');
        const messageTitle = document.querySelector('h2[data-test="messageTitle"]');
        const chatHeader = document.querySelector('header[data-test="chatTitle"]');

        // If no logo exists but we have target elements, try to insert
        if (!existingLogo && (messageTitle || chatHeader)) {
          retryCount = 0; // Reset retry count for reinsertion
          insertLogo();
        }
      }, 500); // Check every 500ms

      // Start logo insertion with a small delay to ensure DOM is ready
      setTimeout(insertLogo, 100);

      return () => {
        clearInterval(logoCheckInterval);
        if (buttonObserver) {
          buttonObserver.disconnect();
        }
      };
    }

    return () => {
      // Cleanup logo elements and observer
      const logoElement = document.querySelector('.company-logo');
      const parentElement = document.querySelector('.company-logo-parent');

      if (logoElement) {
        logoElement.remove();
      }
      if (parentElement) {
        parentElement.classList.remove('company-logo-parent');
      }

      if (buttonObserver) {
        buttonObserver.disconnect();
      }
    };
  }, [companyColors.logo, isThemeReady, updateButtonColors]);

  // Handle favicon injection
  useEffect(() => {
    if (!isThemeReady) return;

    if (companyColors.favicon) {
      FaviconService.createFavicon('company-favicon', companyColors.favicon);
    }

    return () => {
      FaviconService.removeFavicon('company-favicon');
    };
  }, [companyColors.favicon, isThemeReady]);
};
