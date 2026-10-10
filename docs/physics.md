# Physics and assumptions

The engine uses SI units. G = 6.67430 × 10⁻¹¹ m³ kg⁻¹ s⁻²; c = 299792458 m/s (exact). One Julian year is 365.25 SI days.

Coordinate time t is normalized to a static observer at infinity in an isolated spacetime. Δτ = τB − τA: positive offsets mean B gains proper time. Multiple-body comparisons assume equal elapsed asymptotic coordinate time in separate isolated spacetimes; they do not establish a physically exact global reference clock.

Static spherical clocks use the exact Schwarzschild exterior rate √(1 − 2GM/(rc²)). Interior clocks use the exact constant-density solution [3√(1 − u) − √(1 − u(r/R)²)]/2, where u = 2GM/(Rc²) < 8/9. Uniform density and the associated pressure profile are illustrative, particularly for stars.

The Newtonian potential is −GM/r outside and −GM[3 − (r/R)²]/(2R) inside. Rotation uses the first-order rate 1 + Φ/c² − v²/(2c²), v = ωr cos λ. The application's conservative approximation limits are |Φ|/c² ≤ 10⁻⁴, v²/c² ≤ 10⁻⁴, and body and observer rotational-support ratios below 0.1. These are application limits, not universal physical boundaries; second-order terms are omitted. q = ω²R³/(GM) is a spherical equatorial support diagnostic. A nonrotating body's period is encoded as zero. Saturn's adopted parameters exceed this conservative rotation limit; that experiment reports an undefined rate.

Schwarzschild circular geodesics use Ω = √(GM/r³) and dτ/dt = √(1 − 3GM/(rc²)). Only stable orbits at r ≥ 6GM/c² and strictly above the material surface are permitted. Hovering observers are accelerated and distinct from freely orbiting clocks.

Kerr uses Boyer–Lindquist x = rc²/(GM), signed a = χ with |χ| < 1, dimensionless Ω̄ = ΩGM/c³, and signature (−,+,+,+). At the equator, gtt = −(1 − 2/x), gtφ = −2a/x, gφφ = x² + a² + 2a²/x. The observer rate is √(−gtt − 2gtφΩ̄ − gφφΩ̄²). ZAMOs use Ω̄ = −gtφ/gφφ. Stationary observers must be outside the outer horizon and strictly inside the timelike angular-frequency interval. Static observers require x > 2. Circular geodesics use Ω̄ = ±1/(x^(3/2) ± a) and their appropriate stable ISCO limits.

Displayed speeds are relative to local static observers for Schwarzschild orbits, to ZAMOs for Kerr, and use Newtonian speed for weak-field rotation. Compactness is 2GM(r)/(rc²), using enclosed gravitational mass, and tends to zero at the uniform-density center. Geoid structure, oblateness, differential rotation, tides, other bodies, and rotating stellar structure are omitted.

Small offsets use deviations from unity and analytic, rationalized pair differences rather than subtraction of rounded elapsed totals. Live accumulation integrates successive parameter segments with compensated summation. Changing settings does not retroactively change history. Reset clears history; restore also restores default parameters. URL sharing reproduces configuration and starts paused at zero elapsed time.

The celestial grid represents coordinates, not a numerical solution of Einstein's equations. Exterior radii are logarithmically compressed; interior radii are linear. Kerr surfaces are coordinate schematics. Angular playback and frame-dragging guides are schematic, capped independently of time acceleration. Probe dragging changes physical coordinates. Keyboard-accessible coordinate fields provide equivalent control. Without WebGL, an SVG cross-section accompanies the numerical laboratory.

Measured presets carry field-level source metadata. Compact stars and black holes use illustrative masses, radii, and spins. Custom edits retain source lineage while marking edited values as assumed.

## References

- [NASA/JPL planetary physical parameters](https://ssd.jpl.nasa.gov/planets/phys_par.html).
- [NASA Moon Fact Sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html).
- [NASA Sun Fact Sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/sunfact.html): adopted rotation period at 16° latitude.
- [NIST CODATA constants](https://physics.nist.gov/cuu/Constants/).
- [Schwarzschild's exterior solution (1916)](https://arxiv.org/abs/physics/9905030).
- [Schwarzschild's constant-density interior solution (1916)](https://arxiv.org/abs/physics/9912033).
- [Bardeen, Press & Teukolsky (1972), rotating black holes and stable circular orbits](https://doi.org/10.1086/151796).
- [Pugliese & Quevedo (2018), equatorial stationary Kerr observers](https://arxiv.org/abs/1801.06149).
