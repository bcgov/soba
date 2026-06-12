'use client';

/**
 * BC Gov footer.
 *
 * The BC Design System ships a fully-styled, accessible BC Gov footer
 * (logo, link list, land acknowledgement, copyright), so we use it directly
 * instead of maintaining our own markup + CSS module.
 *
 * It is re-exported from this Client Component because the design system is
 * built on React Aria; importing it straight into the (Server Component) layout
 * would pull React Aria into the server module graph and break the build.
 * The `<Footer>` prop API (`hideAcknowledgement`, `contact`, `links`, …) is
 * unchanged, so existing usage continues to work.
 */
export { Footer } from '@bcgov/design-system-react-components';
