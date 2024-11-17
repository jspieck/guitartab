# Guitar Tab Editor

A modern web-based guitar tablature editor built with Vue 3, TypeScript, and Vite. Create, edit, and play guitar tabs with an intuitive interface and professional audio features.

## Features

- 🎸 Interactive guitar tab creation and editing
- 🎵 Real-time audio playback with high-quality guitar samples
- 🎹 Multi-instrument support (Guitar, Bass, Drums, Piano)
- 🎛️ Professional audio tools:
  - Equalizer
  - Mixer
  - Compressor
  - Effects
- 📝 Music notation features:
  - Chord diagrams
  - Time signatures
  - Tempo markers
  - Repeats
  - Grace notes
- 🎮 MIDI device support
- 🌓 Light/Dark mode
- 💾 Import/Export capabilities

## Development Setup

### Prerequisites

- [Node.js](https://nodejs.org/) (v16 or higher)
- [npm](https://www.npmjs.com/) or [yarn](https://yarnpkg.com/)

### Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) with the following extensions:
  - [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar)
  - [TypeScript Vue Plugin (Volar)](https://marketplace.visualstudio.com/items?itemName=Vue.vscode-typescript-vue-plugin)

### Installation

1. Clone the repository
```bash
git clone [repository-url]
```
2. Install dependencies
```bash
npm install
```
or
```bash
yarn install
```
3. Start the development server
```bash
npm run dev
```
or
```bash
yarn dev
```
## Building for Production
```bash
npm run build
```
or
```bash
yarn build
```
## Type Support

This project uses TypeScript for type safety. For `.vue` imports, we use `vue-tsc` for type checking. The TypeScript configuration is set up to work with Vue 3's `<script setup>` syntax.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License

Copyright (c) 2024 Jan Spieck

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.