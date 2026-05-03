# Documentation

This folder contains all project documentation and guides for developers.

---

## 📋 Available Guides

### 1. **[Coding Practices](./coding-practices.md)** 
   **Purpose:** Best practices for writing clean, maintainable code
   
   **Covers:**
   - Separation of concerns
   - Folder & file organization
   - Naming conventions
   - Component design patterns
   - State management
   - API & data layer rules
   - Error handling
   - Code quality standards
   - The golden rule: anyone should understand your project in 5 minutes

   **When to Read:** Before writing any new code, when reviewing PRs, or when unsure about structure

---

### 2. **[Clean Code Guidelines](./clean-code-guidelines.md)**
   **Purpose:** Specific rules for naming files, functions, and variables
   
   **Covers:**
   - Naming conventions (PascalCase, camelCase, kebab-case)
   - File organization by feature
   - Function rules (one thing, ≤20 lines)
   - Separation of responsibility (HTML/CSS/JS)
   - DRY principle
   - Comments and documentation
   - Class guidelines

   **When to Read:** When creating new files or refactoring existing code

---

### 3. **[Supabase Setup Guide](./supabase-setup-guide.md)**
   **Purpose:** Step-by-step instructions to connect the project to Supabase
   
   **Covers:**
   - Creating a Supabase project
   - Getting API keys
   - Configuring environment variables
   - Enabling authentication providers
   - Database setup

   **When to Read:** First time setting up the project or when adding new Supabase features

---

### 4. **[Refactoring Summary](./REFACTORING.md)** ⭐ **COMPLETED**
   **Purpose:** Documentation of the codebase refactoring to follow best practices
   
   **Covers:**
   - All file changes and renames
   - New folder structure
   - Import path updates
   - Hook extraction (`useAuth`)
   - Index file exports
   - Benefits of the refactoring
   - Migration checklist

   **When to Read:** To understand what changed and why, reference when adding new code

---

### 5. **[Cleanup Summary](./CLEANUP.md)** ⭐ **JUST COMPLETED**
   **Purpose:** Documentation of codebase cleanup to remove unnecessary files
   
   **Covers:**
   - Deleted index.ts files (why they were unnecessary)
   - Removed empty folders
   - New styles/ folder organization
   - Updated import paths
   - Final project structure
   - Benefits of the cleanup
   - When to use barrel exports

   **When to Read:** To understand the lean folder structure and import patterns

---

### 6. **[Add Building Floors](./adding-building-floors.md)**
   **Purpose:** Step-by-step guide to add floors to existing buildings or register a new building

   **Covers:**
   - FloorConfig fields to update
   - Which files to edit for new floors
   - Floorplan asset mapping
   - Building registration and loader updates

   **When to Read:** When adding or expanding building floor data

---

## 🚀 Quick Start for New Developers

1. **First, read:** [Cleanup Summary](./CLEANUP.md) (3 min)
   - Understand the lean, clean structure

2. **Then, read:** [Refactoring Summary](./REFACTORING.md) (5 min)
   - Understand what was changed and why

3. **Then, read:** [Coding Practices](./coding-practices.md) (10 min)
   - Learn best practices for writing new code

4. **Finally, read:** [Setup Guide](./supabase-setup-guide.md) (5 min)
   - Get the project running locally

5. **Reference often:** [Clean Code Guidelines](./clean-code-guidelines.md)
   - Check when naming files or refactoring

---

## 📂 Project Structure

```
docs/
├── README.md                    ← You are here
├── cleanup.md                   ← Clean & lean structure
├── refactoring.md              ← What changed and why
├── coding-practices.md          ← Best practices & patterns
├── clean-code-guidelines.md     ← Naming & organization rules
├── adding-building-floors.md    ← Add floors to a building
└── supabase-setup-guide.md      ← Environment & auth setup
```

---

## ✅ Before Committing Code

Make sure your code follows:

- ✅ [Coding Practices](./coding-practices.md) - Structure & patterns
- ✅ [Clean Code Guidelines](./clean-code-guidelines.md) - Naming & formatting
- ✅ No commented-out code
- ✅ Clear commit messages
- ✅ All tests passing
- ✅ No console.log() left behind

---

## 🤝 Contributing

When you add new features or refactor code:

1. Follow the guidelines in these docs
2. Update the relevant documentation if needed
3. Use clear commit messages like:
   ```
   feat: add user registration page
   fix: resolve authentication token issue
   refactor: organize services folder
   docs: update setup guide
   ```

---

## ❓ Questions?

- **Why is the folder structure so lean?** → [Cleanup Summary](./CLEANUP.md)
- **Why are there no index.ts files?** → [Cleanup Summary](./CLEANUP.md#when-to-use-barrel-exports-indexts)
- **How do I import files?** → [Cleanup Summary](./CLEANUP.md#-import-changes) + [Coding Practices](./coding-practices.md#41-import-order)
- **What changed in refactoring?** → [Refactoring Summary](./REFACTORING.md)
- **About code structure?** → [Coding Practices](./coding-practices.md)
- **About how to name files?** → [Clean Code Guidelines](./clean-code-guidelines.md)
- **About setting up the project?** → [Supabase Setup Guide](./supabase-setup-guide.md)
- **About version control?** → See "Version Control Rules" in [Coding Practices](./coding-practices.md)
