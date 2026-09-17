# DQ-TRAIN-001B — Calibration Results

Status: **B1 COMPLETE; PRIMARY CANDIDATE LIVE-SPOT-CHECKED IN A NARROW SPEED DOMAIN**

Observed: 2026-09-17.
Protocol: `CALIBRATION-PROTOCOL-001B.md`.
Candidate: `vladar-v2-pre50m-v1`.

## Privacy boundary

Raw player observations, timestamps, screenshots, and exact personal history are intentionally not committed here. This file records only aggregate, nonidentifying findings sufficient to preserve model-validation state.

## B1 evidence domain

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

Under the frozen 001A multiplier convention, the known gain multiplier for this lane is `1.02 * 1.07 = 1.0914`. B1 compatibility does not by itself prove that every Torn modifier family is implemented multiplicatively in every context.

## Gain-model result

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
- mean normalized inferred-noise midpoint: approximately +0.028 of the positive bound;
- sample standard deviation of inferred-noise midpoints: approximately 807.

The observed inferred-noise values crossed zero repeatedly: five midpoint estimates were positive and seven were negative. There was no obvious one-direction drift over this small sequence. The sample is too small and too narrow to claim a specific noise distribution, independence structure, or statistical confidence interval.

## Happy-loss result

All 12 observed Happy losses were inside the frozen 10E candidate set `{4,5,6}`.

Aggregate counts:

- loss 4: 5 observations;
- loss 5: 6 observations;
- loss 6: 1 observation;
- out-of-set losses: 0.

The cumulative observed Happy loss was 56, taking the chain from 4,275 before the first train to 4,219 after the twelfth. The lowest pre-train Happy represented in the gain-fit set was therefore 4,224.

This supports the candidate Happy-loss rule as live-compatible in this narrow 10E ordinary-training lane. It does not validate 5E, 25E, 50E, Fitness Center reduction, quarter-hour interactions, or other Happy modifiers.

## Model-state decision

`vladar-v2-pre50m-v1` advances from `candidate_not_live_calibrated` to **`live_spot_checked`** for the observed Speed / Complete Cardio / 10E / ordinary-modifier lane only.

This is not `calibrated_observed_domain` yet. B1 was designed to catch gross contradictions and validate the capture/inversion pipeline, not to justify a broad production claim.

The following remain unsupported by this result:

- Strength, Defense, and Dexterity formula fidelity;
- substantially different stat magnitudes;
- elevated-Happy training;
- different gyms or energy costs;
- alternate modifier stacks;
- Fitness Center or other special Happy-loss effects;
- post-50m behavior;
- batch/sequential aggregate behavior;
- exact UI rounding/truncation semantics;
- probabilistic noise distribution assumptions.

## Next evidence gate

Proceed to B2 stat-family calibration using routine training only. Additional Speed samples are lower-value than opening other stat families unless normal play naturally calls for more Speed.

Preferred next evidence is single-train Strength, Defense, or Dexterity under a fully known modifier stack. Partial sets are still useful; there is no requirement to spend extra resources solely to satisfy the matrix.

B3 elevated-Happy, B4 batch, and B5 special/boundary lanes remain pending.
