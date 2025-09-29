/**
 * Svelte 5 Compatibility Shim
 *
 * This module provides compatibility fixes for Svelte 5 event handling issues.
 * It manually attaches event handlers that aren't properly hydrating.
 */

import { browser } from '$app/environment';

/**
 * Manually attach event handlers to buttons with specific text patterns
 * This is a workaround for Svelte 5 hydration issues
 */
export function attachEventHandlers() {
  if (!browser) return;

  console.log('🔧 Svelte 5 compatibility shim: Attaching event handlers...');

  // Wait for DOM to be ready
  setTimeout(() => {
    const buttons = document.querySelectorAll('button');
    let handlersAttached = 0;

    buttons.forEach(button => {
      const text = button.textContent?.trim();

      // Audio control buttons
      if (text === 'Play' || text === 'Pause') {
        button.addEventListener('click', (e) => {
          console.log(`🎵 ${text} button clicked`);
          // Dispatch custom event that can be caught by Svelte components
          button.dispatchEvent(new CustomEvent('svelte:click', {
            detail: { action: text.toLowerCase() },
            bubbles: true
          }));
        });
        handlersAttached++;
      }

      if (text === 'Stop') {
        button.addEventListener('click', (e) => {
          console.log('🛑 Stop button clicked');
          button.dispatchEvent(new CustomEvent('svelte:click', {
            detail: { action: 'stop' },
            bubbles: true
          }));
        });
        handlersAttached++;
      }

      if (text === 'Upload fallback') {
        button.addEventListener('click', (e) => {
          console.log('📁 Upload fallback button clicked');
          button.dispatchEvent(new CustomEvent('svelte:click', {
            detail: { action: 'upload-fallback' },
            bubbles: true
          }));
        });
        handlersAttached++;
      }

      // Orchestration buttons
      if (text === 'Start playback') {
        button.addEventListener('click', (e) => {
          console.log('▶️ Start playback button clicked');
          button.dispatchEvent(new CustomEvent('svelte:click', {
            detail: { action: 'start-playback' },
            bubbles: true
          }));
        });
        handlersAttached++;
      }

      if (text === 'Clear selection') {
        button.addEventListener('click', (e) => {
          console.log('🗑️ Clear selection button clicked');
          button.dispatchEvent(new CustomEvent('svelte:click', {
            detail: { action: 'clear-selection' },
            bubbles: true
          }));
        });
        handlersAttached++;
      }

      // Device selection buttons
      if (text === 'Select' && button.getAttribute('aria-pressed') !== null) {
        button.addEventListener('click', (e) => {
          console.log('✅ Device select button clicked');
          button.dispatchEvent(new CustomEvent('svelte:click', {
            detail: { action: 'toggle-device' },
            bubbles: true
          }));
        });
        handlersAttached++;
      }

      // Library buttons
      if (text === 'Upload track') {
        button.addEventListener('click', (e) => {
          console.log('📤 Upload track button clicked');
          button.dispatchEvent(new CustomEvent('svelte:click', {
            detail: { action: 'upload-track' },
            bubbles: true
          }));
        });
        handlersAttached++;
      }

      if (text === 'New playlist') {
        button.addEventListener('click', (e) => {
          console.log('🎵 New playlist button clicked');
          button.dispatchEvent(new CustomEvent('svelte:click', {
            detail: { action: 'new-playlist' },
            bubbles: true
          }));
        });
        handlersAttached++;
      }

      if (text === 'Play on selected') {
        button.addEventListener('click', (e) => {
          console.log('🎯 Play on selected button clicked');
          button.dispatchEvent(new CustomEvent('svelte:click', {
            detail: { action: 'play-on-selected' },
            bubbles: true
          }));
        });
        handlersAttached++;
      }
    });

    console.log(`✅ Svelte 5 compatibility shim: Attached ${handlersAttached} event handlers`);
  }, 100);
}

/**
 * Re-attach handlers when the page content changes (for SPA navigation)
 */
export function reattachOnNavigation() {
  if (!browser) return;

  // Listen for SvelteKit navigation events
  const observer = new MutationObserver((mutations) => {
    let shouldReattach = false;
    mutations.forEach(mutation => {
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        // Check if new buttons were added
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = /** @type {Element} */ (node);
            if (element.tagName === 'BUTTON' || element.querySelector('button')) {
              shouldReattach = true;
            }
          }
        });
      }
    });

    if (shouldReattach) {
      console.log('🔄 Page content changed, reattaching handlers...');
      setTimeout(attachEventHandlers, 50);
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}