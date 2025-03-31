# Journey Project Guidelines

## Build Commands
- **Development**: `bun run dev` or `npm run dev` (Vite dev server)
- **Build**: `bun run build` or `npm run build` (production build)
- **Preview**: `bun run preview` (preview built version)

## Package Managers
- Bun (preferred) or Yarn

## Code Style
- **Indentation**: 4 spaces
- **Quotes**: Single quotes, template literals for complex strings
- **Semicolons**: None at line endings
- **Imports**: External libraries first, then internal modules
- **Naming**: camelCase (variables, functions), PascalCase (constructors), UPPER_CASE (constants)
- **State**: Centralized in $ or STATE object
- **Error Handling**: Try/catch for validation, console warnings for debugging
- **Comments**: Feature headers, TODOs for improvements, time tracking with console.time

## Architecture
- ES Modules with type="module"
- One component/feature per file
- Related functionality grouped in directories