# DQ-TRAIN-001B — Calibration Results

Status: **B1–B4 COMPLETE; `vladar-v2-pre50m-v1` CALIBRATED IN THE DOCUMENTED OBSERVED DOMAIN**

Observed: 2026-09-17 through 2026-09-25.
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

The first B2 stat-family target is complete for Dexterity with 8 eligible Class-S observations collected during routine manual training. The observations span two short ordinary-play sessions separated by natural energy regeneration; each session was independently captured and no quarter-hour boundary crossed inside an observation.

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

All 8 Dexterity observations matched the frozen 10E Happy-loss set `{4,5,6}`.

- loss 4: 3 observations;
- loss 5: 1 observation;
- loss 6: 4 observations;
- out-of-set losses: 0.

The natural regeneration gap between the two Dex mini-sessions is not treated as a problem because every Class-S observation is calibrated from its own captured pre-train state.

## B2 Defense evidence domain

The B2 stat-family target is also complete for Defense with 8 eligible consecutive Class-S observations from one short routine-training session. The player deliberately waited for natural energy rather than introducing a drug event solely for research, giving this lane a clean ordinary-play pre-state.

Observed lane:

- stat family: Defense;
- trained-stat magnitude: approximately 5.30k to 5.44k;
- Happy before train: 4,240 to 4,275;
- gym: Complete Cardio;
- normalized Defense gym dots: 5.5;
- energy per train: 10;
- repeat quantity: exactly 1;
- known gain modifiers: +2% property gym gains and +6% faction Defense gym gains;
- Education gym-gain modifier: 0%;
- no known temporary training book or other special gain effect;
- no quarter-hour Happy boundary crossed inside an observation.

Under the frozen 001A multiplier convention, the known gain multiplier for this lane is `1.02 * 1.06 = 1.0812`.

### Defense gain-model result

All 8 Defense observations were compatible with the Vladar V2 candidate under the frozen display-quantization and inferred-noise test.

Aggregate diagnostics:

- eligible observations: 8;
- candidate contradictions: 0;
- confirmed contradictions: 0;
- displayed gain range: 17.50 to 18.14 Defense per 10E train;
- zero-noise candidate-center range: approximately 17.697 to 17.785;
- inferred gain-noise midpoint range: approximately -845 to +1,351;
- candidate Defense noise bound: -1,500 to +1,500;
- mean inferred-noise midpoint: approximately +444;
- seven midpoint estimates positive and one negative.

The positive mean in this eight-observation convenience sample is noted rather than explained away. The full inferred-noise range remains inside the candidate bound, so there is no contradiction, but the sample is far too small to infer distribution bias or systematic model drift. Additional ordinary Defense evidence may later test whether the positive skew persists.

### Defense Happy-loss result

All 8 Defense observations matched the frozen 10E Happy-loss set `{4,5,6}`.

- loss 4: 3 observations;
- loss 5: 1 observation;
- loss 6: 4 observations;
- out-of-set losses: 0.

Cumulative observed Happy loss was 41, from 4,275 before the first Defense train to 4,234 after the eighth.

## B2 Strength evidence domain

The final B2 stat-family target is complete for Strength with 8 eligible consecutive Class-S observations from routine manual training. The sequence began immediately after a natural quarter-hour Happy reset and remained inside one short observation window.

Observed lane:

- stat family: Strength;
- trained-stat magnitude: approximately 17.27k to 17.46k;
- Happy before train: 4,240 to 4,275;
- gym: Complete Cardio;
- normalized Strength gym dots: 5.5;
- energy per train: 10;
- repeat quantity: exactly 1;
- known gain modifiers: +2% property gym gains and +7% faction Strength gym gains;
- Education gym-gain modifier: 0%;
- no known temporary training book or other special gain effect;
- no quarter-hour Happy boundary crossed inside an observation.

Under the frozen 001A multiplier convention, the known gain multiplier for this lane is `1.02 * 1.07 = 1.0914`.

### Strength gain-model result

All 8 Strength observations were compatible with the Vladar V2 candidate under the frozen display-quantization and inferred-noise test.

Aggregate diagnostics:

- eligible observations: 8;
- candidate contradictions: 0;
- confirmed contradictions: 0;
- displayed gain range: 22.66 to 23.00 Strength per 10E train;
- zero-noise candidate-center range: approximately 22.738 to 22.817;
- inferred gain-noise midpoint range: approximately -461 to +611;
- candidate Strength noise bound: -700 to +700;
- mean inferred-noise midpoint: approximately +154;
- five midpoint estimates positive and three negative.

Every inferred-noise interval intersected the frozen Strength bound. The small positive mean is preserved as an observation, not treated as evidence of systematic bias.

### Strength Happy-loss result

All 8 Strength observations matched the frozen 10E Happy-loss set `{4,5,6}`.

- loss 4: 2 observations;
- loss 5: 3 observations;
- loss 6: 3 observations;
- out-of-set losses: 0.

Cumulative observed Happy loss was 41, taking the sequence from 4,275 before the first Strength train to 4,234 after the eighth.

## Provisional B4 ordinary-Happy control session

A planned elevated-Happy B3 session on 2026-09-21 did not include either the intended candy step or Ecstasy. No Happy-boosting consumables were used before training. The resulting 1,000E session is therefore a **true ordinary-Happy control**, not B3 elevated-Happy evidence, and is preserved as a provisional B4 batch/control specimen.

Aggregate structure:

- total energy consumed: 1,000E;
- gym: Complete Cardio;
- opening Class-S probes: 8 total, alternating Strength and Speed;
- batch specimens: 8 total, each 11 internal trains / 110E, alternating Strength and Speed;
- closing Class-S probes: 4 total, alternating Strength and Speed;
- total observed Happy consumed by training: 509;
- all training completed inside one quarter-hour window;
- no elevated-Happy claim is made from this session.

The observed gains were consistent with the already-established ordinary-Happy lanes. Because no candy or Ecstasy was consumed, there is no mixed or partial booster state to disentangle. The dataset is still retained as **provisional B4 control evidence**, rather than formal B4 completion, because the exact pre-session Happy was not independently captured under the formal B4 protocol.

Its value is methodological: the eventual elevated-Happy retry can be compared against a same-gym, same-stat-family, 1,000E ordinary-Happy control structure with no Happy-boosting consumables involved.

## B3 elevated-Happy calibration — COMPLETE

A fully captured Happy Jump session on 2026-09-25 supplied the required Class-H single-train evidence.

The controlled pre-state was:

- base Happy: 4,275;
- five Erotic DVDs: +12,500 Happy total;
- post-eDVD Happy: 16,775;
- successful Ecstasy doubling: 33,550 Happy;
- starting Energy: 1,000;
- gym: Complete Cardio;
- same known ordinary modifier stack used in prior calibration;
- no quarter-hour Happy reset crossed during the training sequence.

The session opened with eight alternating 10E singles across Speed and Strength, then performed eight 11-train batches, then closed with four more alternating 10E singles. This yielded **12 eligible elevated-Happy Class-H single observations** across two stat families, exceeding the B3 target of 8.

### B3 Speed result

Six elevated-Happy Speed singles were observed between approximately 33,060 and 33,550 Happy.

- eligible observations: 6;
- displayed gain range: 181.22 to 183.03 Speed per 10E;
- candidate contradictions: 0;
- confirmed contradictions: 0;
- inferred gain-noise midpoint range: approximately -1,183 to +954;
- candidate Speed bound: -1,350 to +1,350;
- mean inferred-noise midpoint: approximately -22.

Every inferred-noise interval intersected the frozen Speed bound.

### B3 Strength result

Six elevated-Happy Strength singles were observed over the same high-Happy session.

- eligible observations: 6;
- displayed gain range: 143.96 to 144.79 Strength per 10E;
- candidate contradictions: 0;
- confirmed contradictions: 0;
- inferred gain-noise midpoint range: approximately -385 to +17;
- candidate Strength bound: -700 to +700;
- mean inferred-noise midpoint: approximately -190.

Every inferred-noise interval intersected the frozen Strength bound.

### B3 Happy-loss result

Across the 12 elevated-Happy singles:

- loss 4: 4 observations;
- loss 5: 6 observations;
- loss 6: 2 observations;
- out-of-set losses: 0.

B3 therefore completes with zero confirmed contradictions in the observed high-Happy Speed/Strength lane.

## B4 sequential batch validation — COMPLETE

The same 2026-09-25 session supplied **8 eligible Class-B observations**, exactly meeting the B4 target. Each batch contained 11 internal 10E trains, alternating between Speed and Strength.

For each batch, the analysis enumerated all allowed internal Happy-loss sequences consistent with the observed aggregate Happy loss and propagated sequential stat/Happy mutation under the frozen candidate. Noise was bounded at the stat-specific candidate limits for every internal train.

All 8 observed batch gains landed inside the resulting full candidate aggregate envelopes.

Observed batches and candidate envelopes:

- Speed +2,000.33; candidate envelope approximately 1,995.74 to 2,005.44;
- Strength +1,583.56; envelope approximately 1,582.35 to 1,587.20;
- Speed +2,003.88; envelope approximately 1,999.38 to 2,009.06;
- Strength +1,586.56; envelope approximately 1,584.15 to 1,588.98;
- Speed +2,009.57; envelope approximately 2,003.54 to 2,013.21;
- Strength +1,588.27; envelope approximately 1,586.26 to 1,591.15;
- Speed +2,011.02; envelope approximately 2,007.42 to 2,017.10;
- Strength +1,589.96; envelope approximately 1,588.12 to 1,592.96.

Batch contradictions: 0.

This validates compatibility of the frozen sequential internal-train rule in the observed Complete Cardio / 10E / elevated-Happy Speed-and-Strength lane. It does not identify the hidden internal random sequence and does not generalize to unobserved gyms, energy costs, special effects, or post-50m behavior.

## Model-state decision

`vladar-v2-pre50m-v1` is now **`live_spot_checked`** in four narrow observed ordinary-training lanes:

1. Speed / Complete Cardio / 5.8 dots / 10E / +2% property / +7% faction Speed;
2. Dexterity / Complete Cardio / 5.2 dots / 10E / +2% property / +6% faction Dexterity;
3. Defense / Complete Cardio / 5.5 dots / 10E / +2% property / +6% faction Defense;
4. Strength / Complete Cardio / 5.5 dots / 10E / +2% property / +7% faction Strength.

B2 stat-family breadth, B3 elevated-Happy coverage, and B4 sequential batch validation are complete in the observed domains. On 2026-09-25 the owner explicitly accepted the bounded calibration claim. `vladar-v2-pre50m-v1` therefore advances to **`calibrated_observed_domain`** only for the documented evidence domain: Complete Cardio, 10E internal trains, the recorded property/faction modifier stack, ordinary-Happy training across all four battle-stat families, elevated-Happy training around 33k Happy for Speed and Strength, and 11-train sequential batches for Speed and Strength.

The following remain unsupported by these results:

- substantially different stat magnitudes outside the observed lanes;
- different gyms or energy costs;
- alternate modifier stacks;
- Fitness Center or other special Happy-loss effects;
- post-50m behavior;
- exact UI rounding/truncation semantics;
- probabilistic noise distribution assumptions.

## Next evidence gate

B1, B2, B3, and B4 are complete, and the owner has accepted the bounded `calibrated_observed_domain` promotion. The next primary project gate is **Training Advisor / Happy Jump Navigator product specification** built above this calibrated kernel.

B5 special/boundary lanes remain separate and opportunistic: Fitness Center/reduced Happy loss, ambiguous special modifiers, different gyms or energy costs, and post-50m behavior.
