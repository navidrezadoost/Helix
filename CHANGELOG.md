# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added

#### Form Builder - Select Field Enhancements
- **Smilodon Integration**: Integrated `@smilodon/core` enhanced-select web component for improved select field rendering and functionality
  - Custom web component replaces standard HTML select for better UX and customization
  - Full support for single and multiselect modes
  - Comprehensive theming support with CSS variables
  
- **Multiselect Support**: Added full multiselect capability to select fields
  - New "Selection mode" property: Single select / Multi-select
  - Per-field selection limit via `validation.max` configuration
  - Adaptive UI display modes (wrap, vertical, horizontal)
  - Proper value binding and state synchronization

- **Per-Option Conditions**: Implemented condition engine for individual select options
  - Each option can have its own validation rules, warnings, and success states
  - Integration with choice condition state manager for real-time preview
  - Support for same-form, other-form, and HTTP event conditions

- **Select Options Modal**: Extracted option management into dedicated focused modal interface
  - Reduces canvas clutter and improves visual clarity
  - Modal provides clean editing experience for labels, values, and per-option conditions
  - "Add option" button relocated to modal footer
  - Inline option editor replaced with clean trigger button showing option count

#### API & Infrastructure
- **CORS Credential Mode Detection**: Implemented intelligent credential handling for cross-origin requests
  - Automatically detects cross-origin requests and omits credentials to prevent CORS preflight failures
  - Maintains backward compatibility for same-origin requests
  - Conditional Content-Type header only when request body exists

#### Styling & Theme
- **Light/Dark Mode Support for Select**: Added comprehensive CSS variable mapping for Smilodon components
  - Automatic theme detection via document.classList
  - Runtime CSS variable injection for seamless light/dark mode switching
  - Variables mapped: background colors, text colors, border colors, focus states, option states
  - Full dark mode override support in FormBuilder.css

- **Select Options Modal Styling**: New modal interface with consistent design system integration
  - Modal follows existing ConnectionModal pattern for consistency
  - Backdrop with blur effect for visual hierarchy
  - Responsive layout: 980px max width, 88vh max height
  - Header with close button, scrollable body, footer with action buttons

### Changed

#### Properties Panel
- **Select Field Properties**: Reorganized to reduce clutter
  - Moved all option management to dedicated modal (canvas-only)
  - Properties panel now only shows: Selection mode setting
  - Removed inline option editor from Properties panel
  - Users must use canvas modal for adding/editing/deleting options

#### Form Canvas
- **Inline Options Editor**: Refactored for selective visibility
  - Extracted common option list rendering into reusable `renderOptionsList()` helper
  - Checkbox/Radio fields: Inline editor remains unchanged with full functionality
  - Select fields: Hidden inline editor, replaced with modal trigger button + option count badge
  - "Add option" button only visible for checkbox/radio (select now uses modal footer)

#### CSS Updates
- **Modal Footer Layout**: Changed from `flex-end` to `space-between` for better button arrangement
  - "Add option" button on left side
  - "Done" button on right side
  - Improved visual balance and usability

### Fixed

- **CORS Preflight Errors**: Fixed issue where credentials mode conflicted with wildcard CORS headers
  - Root cause: Hardcoded `credentials: 'include'` triggered CORS validation failure
  - Solution: Conditional credentials based on request origin

- **React Ref Warning**: Fixed "Cannot give refs to function components" warning in AnimatePresence
  - Root cause: SortableFieldItem missing ref forwarding
  - Solution: Converted component to `forwardRef<HTMLDivElement>` with proper Node forwarding

- **NotSupportedError on Custom Element Creation**: Fixed crash when creating enhanced-select elements
  - Root cause: Direct React JSX render of web component failed in React 18
  - Solution: Imperative document.createElement() in useEffect with manual DOM attachment

- **Select Field Not Responding**: Fixed Smilodon API integration issues
  - Fixed incorrect custom element tag lookup and method names
  - Corrected value sync using proper `setSelectedValues()` API
  - Proper event listener attachment to `change` event with correct detail property

- **Select Not Visible in Preview**: Fixed theming issues with light/dark mode
  - Root cause: Smilodon defaults not inheriting form builder CSS variables
  - Solution: Runtime CSS variable injection keyed on dark mode detection

- **Dense UI / Canvas Clutter**: Resolved user experience issue with overwhelmingly busy interface
  - Moved select option management from Properties + Canvas to dedicated modal
  - Reduced visual complexity while maintaining full functionality
  - Improved focus and usability

### Dependencies

- Added: `@smilodon/core` - Web component library for enhanced select functionality
- Added: `@smilodon/react` - React integration for Smilodon components

### Testing & Validation

- TypeScript compilation: ✅ 0 errors
- Vite bundling: ✅ Success (2971 modules transformed, ~600KB JS output)
- CSS parsing: ✅ All new styles validated
- Dark mode: ✅ Tested light/dark switching with theme variables
- Accessibility: ✅ ARIA labels and keyboard navigation maintained

### Migration Notes

For existing forms using select fields:
- No breaking changes to form schema structure
- Existing forms will automatically use new select options modal
- Single-select forms will work unchanged; multi-select available via Selection mode property
- All option management now happens exclusively in canvas modal (not Properties panel)

### Developer Notes

#### Architecture
- **Component Interaction**: PropertyEditor ↔ FormCanvas ↔ FormPreview
- **State Management**: React hooks (useState, useEffect, useMemo, useRef)
- **Styling**: CSS variables with ::root and .dark scoped definitions
- **Animation**: Framer Motion for modal entrance/exit (spring, scale, opacity)

#### Key Files Modified
1. `FormPreview.tsx`: Smilodon integration, value binding, theme variable injection
2. `FormCanvas.tsx`: Modal routing, option management, conditional rendering
3. `PropertyEditor.tsx`: Removed select option editor, kept selection mode setting
4. `FormBuilder.css`: Added ~129 lines for modal styling and theme support
5. `schemas.ts`: CORS credential mode detection in request() function

## [Previous Versions]

- See git history for earlier changes and releases
