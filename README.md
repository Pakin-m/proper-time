# Proper Time

Explore how gravity and motion affect elapsed time. Proper Time is an interactive browser app that compares two clocks around planets, stars, and black holes.

## Features

- Compare clocks at different altitudes, inside spherical bodies, or in circular orbits.
- Explore weak-field rotation and equatorial Kerr spacetime.
- Use celestial presets or adjust mass, radius, rotation, and spin.
- View projected and live accumulated time differences.
- Share an experiment by URL or export a PNG snapshot.

## Development

Requires Node.js 22.19 or later and npm.

```sh
npm ci
npm run dev
```

Check the project and build for production:

```sh
npm test
npm run build
npm run preview
```

`npm run build` runs the TypeScript check and writes the static app to `dist/`.

## Deployment

Serve `dist/` with any static host. Relative asset paths support hosting under a repository subdirectory.

For GitHub Pages, select **GitHub Actions** under **Settings > Pages**. The included workflow tests and builds pull requests, and deploys pushes to `main`.

## Models and limitations

The app uses Schwarzschild models for spherical bodies, a first-order approximation for weak-field rotation, and the equatorial Kerr metric for rotating black holes. Results use SI units; positive time differences mean clock B accumulates more time than clock A.

Uniform-density interiors and compact-object presets are illustrative. The visualization is schematic, and the models omit effects such as oblateness, tides, and other bodies. Comparisons between different bodies assume equal coordinate durations in separate isolated spacetimes.

See [Physics and assumptions](docs/physics.md) for equations, validity limits, numerical methods, and references. The app also displays model assumptions and preset sources.

## Project structure

- `src/physics.ts`: clock rates, model validation, and numerical accumulation.
- `src/presets.ts`: celestial presets and source metadata.
- `src/state.ts`: experiment configuration and URL serialization.
- `src/App.tsx`, `src/Scene.tsx`: controls, results, and visualization.
- `src/Assumptions.tsx`, `src/snapshot.ts`: model notes and PNG export.
- `src/*.test.ts`: physics and state tests.

## License

[MIT](LICENSE).
