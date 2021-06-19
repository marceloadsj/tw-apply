# tw-apply/macro

[![npm version](https://badge.fury.io/js/tw-apply.svg)](https://badge.fury.io/js/tw-apply)

Maintain the speed of developing with Tailwind while creating overwritable class names.

---

## Install

> yarn add tw-apply

- Setup Babel Macro: https://github.com/kentcdodds/babel-plugin-macros

  - Create-React-App: Supported out of the box
  - Next.js: https://github.com/vercel/next.js/tree/canary/examples/with-babel-macros

- Setup CSS-Modules: https://github.com/css-modules/css-modules

  - Create-React-App: Supported out of the box
  - Next.js: Supported out of the box

- Increase the specificity of your utility classes: https://tailwindcss.com/docs/configuration#selector-strategy
  - You can use a simple tag selector, like **html**

---

## Usage

```typescript
import "tw-apply/macro";

function Button({ className = "", ...props }) {
  return (
    <button
      className={`@apply bg-red-500 text-white ${className}`}
      {...props}
    />
  );
}

function App() {
  return <Button className="bg-blue-500" />; // I will be red :)
}
```

---

## Motivation

[Tailwind](https://tailwindcss.com/) is an awesome library with a solid base theme that allows the developer to build UIs really **fast**.

But there is one design detail of Tailwind _(or... CSS in general?)_ that makes writing reusable components that accepts **className** not that fast.

**The issue: Specificity**

```typescript
function Button({ className = "", ...props }) {
  return <button className={`bg-red-500 text-white ${className}`} {...props} />;
}

function App() {
  return <Button className="bg-blue-500" />; // I will not be blue :(
}
```

When you create a component that uses the Tailwind classes, and it accepts a _className_, you will face specificity issues when trying to overwrite those classes.

Changing the order of the keys on _tailwind.config.js_ can fix one case, but might break others.

**The possible solution: @apply**

```css
.my-super-beautiful-button {
  @apply bg-red-500 text-white;
}
```

```typescript
function Button({ className = "", ...props }) {
  return (
    <button className={`my-super-beautiful-button ${className}`} {...props} />
  );
}

function App() {
  return <Button className="bg-blue-500" />; // I will not be blue :(
}
```

The way you can solve this problem is using the **@apply** function to create a new rule using Tailwind classes.

And that's when you slow down your coding: you have to give that class a **name**, and as we as all know, _Naming things is one of the hardest problem in Computer Science_.

**The solution: tw-apply/macro**

```typescript
import "tw-apply/macro";

function Button({ className = "", ...props }) {
  return (
    <button
      className={`@apply bg-red-500 text-white ${className}`}
      {...props}
    />
  );
}

function App() {
  return <Button className="bg-blue-500" />; // I will be red :)
}
```
