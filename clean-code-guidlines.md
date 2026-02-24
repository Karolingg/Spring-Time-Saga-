# Clean Code Guidelines

## Naming Conventions
- **Names are meaningful.**
- **Functions:** camelCase (e.g., `handleSubmitClick`)
- **Variables:** camelCase (e.g., `userName`)
- **Constants:** UPPER_SNAKE_CASE (e.g., `API_URL`)
- **Classes:** PascalCase (e.g., `UserCard`)
- **Class Methods:** camelCase
- **Boolean Variables:** Prefix with is, has, should, can (e.g., `isLoading`)
- **File Names:** kebab-case (e.g., `user-card.js`)
- **HTML id/class:** BEM with kebab-case (e.g., `user-card__edit-button`)
- **HTML IDs:** UPPER_SNAKE_CASE (e.g., `SUBMIT_BUTTON`)
- **Event Handlers:** Prefix with handle (e.g., `handleModalClose`)
- **DOM Element Variables:** Prefix with `$` (e.g., `$submitButton`)

## File Organization
- Organize files by feature.
- Example structure:
  - `/components/card/card.html`, `card.css`, `card.js`
  - `/pages/dashboard/dashboard.html`, `dashboard.js`
  - `/services/api-client.js`, `auth-service.js`
  - `/utils/dom-utils.js`
  - `/styles/base.css`
- Avoid subfolders if a folder has fewer than ~7 files.

## Function Rules
- A function does one thing only.
- A function is ≤ 20 lines.
- Function name describes what, not how.
- Blocks inside `if`, `else`, and `while` should be around one line long.

## Separation of Responsibility
- HTML, CSS, and JS are in separate files.
- Do not mix UI and logic in one function.
- Separate DOM, storage, and business logic into different files (e.g., `card-dom.js`, `storage-service.js`).

## DRY Principle
- No duplicate code.
- Use classes to abstract repeated logic.

## HTML Rules
- No inline styles or JS.
- Only structure in HTML.

## CSS Rules
- Use BEM for class naming.
- No ID selectors.
- No element selectors (e.g., `div {}`).
- All styles must be reusable and composable through classes.

## Maximum File Size
- If a JS file > 200 lines, break it into separate files.

## Comments
- No commented unused code.
- Only comment on non-obvious intent.

## Error Handling
- Throw exceptions, not error codes.
- Never add try/catch inside business logic.

## Class Guidelines
- Use classes to encapsulate DOM, events, and state when needed.
- Example:

```js
export class Card {
  constructor({ id, title, description, status }) {
    this.id = id;
    this.title = title;
    this.description = description;
    this.status = status;
    this.$element = null;
  }

  render($container) {
    this.$element = this.createElement();
    $container.appendChild(this.$element);
    this.attachEventListeners();
  }

  createElement() {
    const $card = document.createElement('div');
    $card.className = 'card';
    $card.dataset.id = this.id;
    $card.innerText = this.title;
    return $card;
  }

  attachEventListeners() {
    this.$element.addEventListener('click', this.handleClick.bind(this));
  }

  handleClick() {
    console.log(`Card ${this.id} clicked`);
  }

  updateTitle(newTitle) {
    this.title = newTitle;
    this.$element.innerText = newTitle;
  }

  updateStatus(newStatus) {
    this.status = newStatus;
  }

  remove() {
    this.$element.remove();
  }

  toJSON() {
    return {
      id: this.id,
      title: this.title,
      description: this.description,
      status: this.status
    };
  }

  static fromJSON(data) {
    return new Card(data);
  }
}
```
