# Best Coding Practices for Website Code Structure

A comprehensive guide for writing clean, maintainable, and scalable web applications.

---

## 1. Core Principles

### 1.1 Separation of Concerns

Each file and folder must have one responsibility only.

| Responsibility | Location |
|---|---|
| UI rendering | `components` |
| Page logic | `pages` |
| Data fetching | `services` |
| Business logic | `services` |
| Global state | `context` / `store` |
| Helpers | `utils` |

**Never mix these in one file.**

---

## 2. Folder & File Organization Rules

### 2.1 Feature-Based Organization

Group files by what they do, not by type alone.

**✅ Good:**
```
components/
  Button/
    Button.js
    Button.css
    index.js
```

**❌ Avoid:**
```
components/
  Button.js
  Button.css
```

This keeps related files together and scalable.

### 2.2 One File, One Responsibility

- One component per file
- One class per file
- One major function per file (unless tightly related)
- If a file grows too large, split it

---

## 3. Naming Conventions

### 3.1 Files & Folders

| Type | Convention | Example |
|---|---|---|
| Components | PascalCase | `UserProfile.js` |
| Hooks | useSomething | `useAuth.js` |
| Utilities | camelCase | `formatDate.js` |
| Constants | UPPER_SNAKE_CASE | `USER_ROLES.js` |
| Services | camelCase | `authService.js` |
| Context | PascalCase | `AuthContext.js` |

### 3.2 Variables & Functions

Use descriptive names. Avoid abbreviations unless standard.

**❌ Bad:**
```javascript
x, y, data1
let d = new Date()
```

**✅ Good:**
```javascript
userProfile
isAuthenticated
fetchUserData
let currentDate = new Date()
```

---

## 4. Import & Dependency Rules

### 4.1 Import Order

Imports must follow this order:

1. External libraries
2. Internal shared modules
3. Local files

**❌ Bad:**
```javascript
import Button from './Button'
import React from 'react'
import { useAuth } from '../context/auth-context'
```

**✅ Good:**
```javascript
import React from 'react'
import { useAuth } from '@/context/auth-context'
import Button from './Button'
```

### 4.2 Avoid Deep Relative Imports

**❌ Bad:**
```javascript
import helpers from '../../../utils/helpers'
```

**✅ Good:**
```javascript
import helpers from '@/utils/helpers'
```

Use path aliases (`@/`) to avoid deep relative imports.

---

## 5. Component Design Rules (Frontend)

### 5.1 Components Must Be Dumb by Default

Components receive data via props. They do not:
- Fetch data directly
- Contain business logic
- Make API calls

**❌ Bad:**
```javascript
function UserProfile() {
  const [user, setUser] = useState(null)
  
  useEffect(() => {
    fetch('/api/user').then(res => setUser(res))
  }, [])
  
  return <div>{user.name}</div>
}
```

**✅ Good:**
```javascript
function UserProfile({ user }) {
  return <div>{user.name}</div>
}
```

### 5.2 Pages Handle Logic

- Pages fetch data
- Pages connect state
- Pages assemble components
- Components only render

---

## 6. State Management Rules

### 6.1 Local State First

Use local state when possible. Global state only when shared.

**Do NOT put everything in global state.**

### 6.2 Centralized Global State

- One store or context per domain
- No direct mutations
- Always update through actions/functions

**✅ Good Pattern:**
```javascript
// authContext.js
export function useAuth() {
  return useContext(AuthContext)
}

// Component usage
function LoginPage() {
  const { login, isAuthenticated } = useAuth()
  // ...
}
```

---

## 7. API & Data Layer Rules

### 7.1 API Calls in Services Only

All HTTP requests must live in `services/`.

**❌ Bad:**
```javascript
// In a component
fetch('/api/login')
```

**✅ Good:**
```javascript
// In authService.ts
export async function loginWithEmail(email, password) {
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw new Error(error.message)
}

// In component
async function handleLogin() {
  await loginWithEmail(email, password)
}
```

### 7.2 Never Call APIs in Components

Components do not know where data comes from. Services handle all data fetching.

---

## 8. Backend Structure Rules

### 8.1 Route → Controller → Service → Model

```
Request
  ↓
Route (URL mapping)
  ↓
Controller (HTTP logic)
  ↓
Service (business logic)
  ↓
Model (database)
```

Each layer has a strict role.

### 8.2 Controllers Are Thin

Controllers should only:
- Validate input
- Call service
- Return response

**They do NOT contain logic.**

**✅ Good Controller:**
```javascript
// Thin controller
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body
    
    // Validation
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Missing fields' })
    }
    
    // Call service
    const result = await authService.login(email, password)
    res.json({ success: true, data: result })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})
```

---

## 9. Error Handling

### 9.1 Centralized Error Handling

- One error handler
- One response format
- Consistent error structure

**Standard Response Shape:**
```json
{
  "success": false,
  "message": "Invalid credentials",
  "code": "AUTH_INVALID_CREDENTIALS",
  "statusCode": 401
}
```

### 9.2 Never Ignore Errors

Every async operation must handle:

- ✅ Success case
- ✅ Failure case
- ✅ Edge cases

**✅ Good Pattern:**
```javascript
try {
  const user = await authService.getCurrentUser()
  if (!user) {
    // Edge case: no user
    return redirect('/auth')
  }
  setUser(user)
} catch (error) {
  // Failure case
  console.error('Failed to fetch user:', error)
  setError(error.message)
}
```

---

## 10. Styling Rules

### 10.1 Scoped Styles

- One CSS file per component
- No global styles unless truly global
- Use CSS modules or scoped CSS

### 10.2 No Inline Styles for Logic

**❌ Bad:**
```jsx
<div style={{ color: isError ? 'red' : 'black' }}>
  Error message
</div>
```

**✅ Good:**
```jsx
<div className={isError ? 'error' : ''}>
  Error message
</div>

// In CSS file
.error {
  color: red;
}
```

---

## 11. Reusability Rules

### 11.1 Don't Copy-Paste

If you use it twice, extract it into a shared utility, component, or hook.

### 11.2 Utilities Are Pure

Utility functions should:
- ❌ Have no side effects
- ❌ Not access DOM
- ❌ Not make API calls
- ✅ Be deterministic (same input → same output)

**✅ Good Utility:**
```javascript
// formatDate.js
export function formatDate(date, format = 'MM/DD/YYYY') {
  // Pure function, no side effects
  return formatted
}
```

---

## 12. Code Quality Rules

### 12.1 Keep Functions Small

- Ideal: under 20–30 lines
- One clear purpose
- Easy to test

### 12.2 Avoid Magic Numbers

**❌ Bad:**
```javascript
if (age > 17) {
  // ...
}
```

**✅ Good:**
```javascript
const LEGAL_AGE = 18

if (age > LEGAL_AGE) {
  // ...
}
```

---

## 13. Documentation Rules

### 13.1 README Must Explain

- Project purpose
- Folder structure
- How to run
- Tech stack
- Environment setup

### 13.2 Code Comments

- Comment on non-obvious intent
- Don't comment obvious code
- ❌ No commented-out code blocks

**✅ Good:**
```javascript
// Retry logic with exponential backoff
async function fetchWithRetry(url, maxAttempts = 3) {
  // ...
}
```

---

## 14. Version Control Rules

### 14.1 Commit Discipline

- One feature per commit
- Clear, descriptive messages
- Use conventional commits

**✅ Good Commits:**
```
feat: add user authentication with email
fix: resolve token expiration issue
refactor: reorganize folder structure
docs: add setup guide
```

**❌ Bad Commits:**
```
update
fix stuff
changes
```

---

## 15. Folder Structure Template

```
project-root/
├── docs/                          # Documentation
│   ├── coding-practices.md
│   ├── setup-guide.md
│   └── api-documentation.md
├── public/                        # Static assets
│   └── favicon.ico
├── src/
│   ├── config/                    # Configuration
│   │   └── supabase.ts
│   ├── context/                   # React Context
│   │   ├── AuthContext.tsx
│   │   └── UserContext.tsx
│   ├── services/                  # API & Business Logic
│   │   ├── auth-service.ts
│   │   ├── user-service.ts
│   │   └── api-client.ts
│   ├── types/                     # TypeScript Types
│   │   ├── user.ts
│   │   └── auth.ts
│   └── utils/                     # Utilities
│       ├── format-date.ts
│       └── validate-email.ts
├── components/                    # UI Components
│   ├── auth/
│   │   ├── AuthBar.tsx
│   │   └── LoginForm.tsx
│   ├── common/
│   │   ├── Button.tsx
│   │   └── Card.tsx
│   └── layout/
│       └── Header.tsx
├── app/                           # Next.js App (Routes & Pages)
│   ├── auth/
│   │   └── page.tsx
│   ├── dashboard/
│   │   └── page.tsx
│   ├── layout.tsx
│   ├── page.tsx
│   └── globals.css
├── .env.local                     # Environment Variables
├── .gitignore
├── package.json
├── tsconfig.json
├── next.config.ts
└── README.md
```

---

## 16. The Golden Rule

**If someone else opens your project, they should understand it in 5 minutes.**

This means:
- Clear folder structure
- Descriptive file names
- Obvious file purposes
- Minimal guessing required
- Good README documentation

---

## Quick Checklist

- [ ] All files have single responsibility
- [ ] Components are dumb (receive props only)
- [ ] Services handle all API calls
- [ ] No deep relative imports
- [ ] Files follow naming conventions
- [ ] Global state is minimal
- [ ] Errors are handled properly
- [ ] Code is well-documented
- [ ] Commits have clear messages
- [ ] Folder structure is logical
