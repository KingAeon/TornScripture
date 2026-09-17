# DQ-TRAIN-001B — Calibration Results

Status: **B1 COMPLETE; B2 PARTIAL WITH SPEED + DEXTERITY LIVE-SPOT-CHECKED IN NARROW DOMAINS**

Observed: 2026-09-17.
Protocol: `CALIBRATION-PROTOCOL-001B.md`.
Candidate: `vladar-v2-pre50m-v1`.

## Privacy boundary

Raw player observations, timestamps, screenshots, and exact personal history are intentionally not committed here. This file records only aggregate, nonidentifying findings sufficient to preserve model-validation state.

## B1 Speed evidence domain

The B1 smoke/falsification gate used 12 consecutive eligible Class-S observations from routine manual training. The observed domain was deliberately narrow:

- stat family: Speed only;
- trained-stat magnitude: approximately 81.6k to 82.2k;
- Happy before train: 4,224 to 4,275;
- gym: Complete Cardio;
- normalized Speed gym dots: 5.8;
- energy per train: 10;
- repeat quantity: exactly 1 for every observation;
- known gain modifiers: +2% property gym gains and +7% faction Speed gym gains;
- Education gym-gain modifier: 0%;
- no known temporary training book or other special gain effect;
- no quarter-hour Happy boundary crossed inside an observation;
- no intervening gameplay action inside an observation.

Under the frozen 001A multiplier convention, the known gain multiplier for this lane is `1.02 * 1.07 = 1.0914`.

### Speed gain-model result

All 12 observations were compatible with the Vladar V2 candidate after applying the 001B two-decimal display-quantization interval and solving each observation for the hidden gain-noise interval.

Aggregate diagnostics:

- eligible observations: 12;
- candidate contradictions: 0;
- confirmed contradictions: 0;
- displayed gain range: 48.33 to 49.01 Speed per 10E train;
- zero-noise candidate-center range across the sequence: approximately 48.610 to 48.635;
- inferred gain-noise midpoint range: approximately -931 to +1,212;
- candidate Speed noise bound: -1,350 to +1,350;
- mean inferred-noise midpoint: approximately +37;
- five midpoint estimates positive and seven negative.

The small sample showed no obvious one-direction residual drift. It is too small and too narrow to claim a particular noise distribution or confidence interval.

### Speed Happy-loss result

All 12 observed Happy losses were inside the frozen 10E candidate set `{4,5,6}`.

- loss 4: 5 observations;
- loss 5: 6 observations;
- loss 6: 1 observation;
- out-of-set losses: 0.

The cumulative observed Happy loss was 56, taking the chain from 4,275 before the first train to 4,219 after the twelfth.

## B2 Dexterity evidence domain

The first B2 stat-family target is now complete for Dexterity with 8 eligible Class-S observations collected during routine manual training. The eight observations span two short ordinary-play sessions separated by natural energy regeneration; each session was independently captured and no quarter-hour boundary crossed inside an observation.

Observed lane:

- stat family: Dexterity;
- trained-stat magnitude: approximately 5.39k to 5.53k;
- Happy before train: approximately 4,209 to 4,233 across the observed samples;
- gym: Complete Cardio;
- normalized Dexterity gym dots: 5.2;
- energy per train: 10;
- repeat quantity: exactly 1;
- known gain modifiers: +2% property gym gains and +6% faction Dexterity gym gains;
- Education gym-gain modifier: 0%;
- no known temporary training book or other special gain effect.

Under the frozen 001A multiplier convention, the known gain multiplier for this lane is `1.02 * 1.06 = 1.0812`.

### Dexterity gain-model result

All 8 Dexterity observations were compatible with the Vladar V2 candidate under the same two-decimal display-quantization and inferred-noise test used for Speed.

Aggregate diagnostics:

- eligible observations: 8;
- candidate contradictions: 0;
- confirmed contradictions: 0;
- displayed gain range: 17.06 to 17.39 Dexterity per 10E train;
- zero-noise candidate-center range: approximately 17.125 to 17.218;
- inferred gain-noise midpoint range: approximately -504 to +770;
- candidate Dexterity noise bound: -1,000 to +1,000;
- mean inferred-noise midpoint: approximately +44.

Every inferred-noise interval remained comfortably inside the frozen Dexterity bound. This is compatible with the candidate in the observed narrow lane but does not establish the shape or independence of the hidden-noise distribution.

### Dexterity Happy-loss result

All 8 Dexterity observations also matched the frozen 10E Happy-loss set `{4,5,6}`.

- loss 4: 3 observations;
- loss 5: 1 observation;
- loss 6: 4 observations;
- out-of-set losses: 0.

The natural regeneration gap between the two Dex mini-sessions is not treated as a problem because every Class-S observation is calibrated from its own captured pre-train state.

## Model-state decision

`vladar-v2-pre50m-v1` is now **`live_spot_checked`** in two narrow observed ordinary-training lanes:

1. Speed / Complete Cardio / 5.8 dots / 10E / +2% property / +7% faction Speed;
2. Dexterity / Complete Cardio / 5.2 dots / 10E / +2% property / +6% faction Dexterity.

This is still not `calibrated_observed_domain` for the model as a whole. Strength and Defense have not yet reached live stat-family coverage, and the evidence remains concentrated around one gym, one energy cost, ordinary Happy, and one player's known modifier patterns.

The following remain unsupported by these results:

- Strength and Defense formula fidelity;
- substantially different stat magnitudes outside the observed lanes;
- elevated-Happy training;
- different gyms or energy costs;
- alternate modifier stacks;
- Fitness Center or other special Happy-loss effects;
- post-50m behavior;
- batch/sequential aggregate behavior;
- exact UI rounding/truncation semantics;
- probabilistic noise distribution assumptions.

## Next evidence gate

Continue B2 breadth using routine single-train Strength or Defense observations under fully known modifiers. Additional Speed or Dexterity samples are lower priority unless ordinary play naturally calls for them.

B3 elevated-Happy, B4 batch, and B5 special/boundary lanes remain pending.
