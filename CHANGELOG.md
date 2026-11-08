# Changelog

All notable changes are listed here. The project follows semantic versioning; `0.x` means the first, still evolving releases.

## 0.1.2 - readability
- Centre of gravity: stylised side view of the car with a dot showing the estimated position (longitudinal from the weight distribution, height from low/medium/high or the automatic estimate).
- Toe diagram: labels moved out of the drawing to a caption below it; the dashed axis no longer crosses the text.

## 0.1.1 - update fix
- The service worker now fetches from the network first and uses the cache only offline; an installed copy no longer stays stuck on the first downloaded version. The page reloads once when a new service worker takes over.

## 0.1.0 - model audit
- Suspension: matched front/rear natural frequency (game manual); rear/front ratio configurable; brake balance starts at 0 and is used as a quick-fix lever; brake direction texts follow the manual.
- Toe diagram (top view) and quick fixes now move the same physical amount whatever range is set.
- Downforce counts in PP: separate front and rear coefficients from four cross readings, front/rear ratio penalty (validated on Lamborghini Huracan GT3 and Ferrari 430), optional PP lever with floors (front 25%, rear 50%) and a rear floor in the generator.
- Ride height follows the game text (front lower: oversteer, rear lower: understeer, small effect); no stability term.
- Physical parameters (Hz, camber, toe, differential levels, damping, anti-roll bars, brake balance) are computed in game units and clamped to the user's range; ride height, downforce levels and gears stay positional.
- New "Car type" selector (road-prepared / already race): default Hz range 1.75-3.75 or 3-5 and a higher base frequency for race cars (hypothesis, to be calibrated on track).
- Fixed the under/oversteer bar offset (FF and 4WD were stuck at the bottom).
- Test tools in `tools/`: safety net (3528 configurations), quick-fix audit, aero PP check, range mapping check.

## 0.0.0 - first release
- Setup generator from weight, weight distribution, engine position, drivetrain, aspiration, center of gravity, front/rear tyres, PP, surface (tarmac, dirt, snow), circuit profile and driving style.
- Installed-parts awareness: only the settings the car can adjust are shown (suspension, LSD, center differential, aero, brake controller, transmission, 4WS, ECU, restrictor, ballast).
- Editable min/max/step and optional current values for every parameter.
- Live effect bars (under/oversteer, turn-in, stability, exit traction, braking, grip) and 17 quick fixes grouped by symptom.
- PP planner with ECU, power restrictor and ballast (weight and position), plus a loop that corrects its estimate from the PP read.
- Levels (auto, weak, neutral, strong or a percentage) for downforce, top speed and rear steering.
- Final drive and individual gear ratios as a percentage of each gear's range.
- Info popup on every option, glossary; save everything to a file (JSON) and reopen it later.
- Optional extra data (low/high-speed stability read as numbers and classified automatically, rotational G at three speeds), weight split as front:rear, estimated centre of gravity.
- Layout selector (FF, FR, MR, RR, 4WD) and unit selectors (kg/lb, CV/kW/hp, Nm/kgfm/lb-ft).
- Measure button (marks the setup you have in the car), per-value difference from it, undo and previous-setup restore, values summary.
- English and Italian, installable offline PWA.
