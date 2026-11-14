"""
FuzzyABR - Mamdani fuzzy inference engine
Inputs: bandwidth (Mbps), buffer (seconds), delay (ms)
Output: quality (144-1080, resolution-height proxy)
"""

import numpy as np
import skfuzzy as fuzz
from skfuzzy import control as ctrl

# ---- Inputs ----
bandwidth = ctrl.Antecedent(np.arange(0, 16.01, 0.1), 'bandwidth')
buffer_ = ctrl.Antecedent(np.arange(0, 30.01, 0.5), 'buffer')
delay = ctrl.Antecedent(np.arange(0, 400.01, 1), 'delay')

# ---- Output ----
quality = ctrl.Consequent(np.arange(144, 1081, 1), 'quality')

# ---- Bandwidth (Mbps): 2=weak, 5=ok, 8=good, 12-14=best ----
bandwidth['low'] = fuzz.trapmf(bandwidth.universe, [0, 0, 2, 4])
bandwidth['medium'] = fuzz.trimf(bandwidth.universe, [3, 5, 7])
bandwidth['high'] = fuzz.trimf(bandwidth.universe, [6, 8, 11])
bandwidth['excellent'] = fuzz.trapmf(bandwidth.universe, [10, 13, 16, 16])

# ---- Buffer (seconds of video stored ahead) ----
buffer_['draining'] = fuzz.trapmf(buffer_.universe, [0, 0, 3, 8])
buffer_['healthy'] = fuzz.trimf(buffer_.universe, [5, 14, 22])
buffer_['full'] = fuzz.trapmf(buffer_.universe, [18, 25, 30, 30])

# ---- Delay (round-trip ms) ----
delay['low'] = fuzz.trapmf(delay.universe, [0, 0, 50, 100])
# Starts at 90 so it overlaps 'low' (which ends at 100); no hole at 100ms.
delay['high'] = fuzz.trapmf(delay.universe, [90, 150, 400, 400])

# ---- Output quality levels ----
quality['panic'] = fuzz.trimf(quality.universe, [144, 144, 280])
quality['low'] = fuzz.trimf(quality.universe, [240, 400, 560])
quality['medium'] = fuzz.trimf(quality.universe, [480, 700, 880])
quality['high'] = fuzz.trimf(quality.universe, [800, 1080, 1080])

# ---- Rules ----
rules = [
    # Safety overrides
    ctrl.Rule(delay['high'], quality['panic']),
    ctrl.Rule(buffer_['draining'], quality['low']),
    ctrl.Rule(bandwidth['low'], quality['low']),
    # Throughput x buffer grid (buffer is healthy or full from here on)
    ctrl.Rule(bandwidth['medium'] & (buffer_['healthy'] | buffer_['full']), quality['medium']),
    ctrl.Rule(bandwidth['high'] & buffer_['healthy'], quality['medium']),
    ctrl.Rule(bandwidth['high'] & buffer_['full'], quality['high']),
    ctrl.Rule(bandwidth['excellent'] & (buffer_['healthy'] | buffer_['full']), quality['high']),
]
_system = ctrl.ControlSystem(rules)


def decide(bw, buf, dly):
    """Return a quality in 144-1080, or None if no rule fired (coverage gap)."""
    sim = ctrl.ControlSystemSimulation(_system)
    sim.input['bandwidth'] = float(np.clip(bw, 0, 16))
    sim.input['buffer'] = float(np.clip(buf, 0, 30))
    sim.input['delay'] = float(np.clip(dly, 0, 400))
    try:
        sim.compute()
    except ValueError:  # newer skfuzzy raises when no rule fires
        return None
    if 'quality' not in sim.output:  # older versions omit the key
        return None
    return round(float(sim.output['quality']), 2)


def find_gaps():
    """Grid-scan the input space for combinations where no rule fires."""
    gaps = []
    for bw in range(0, 17):
        for buf in range(0, 31, 5):
            for dly in range(0, 401, 25):
                if decide(bw, buf, dly) is None:
                    gaps.append((bw, buf, dly))
    return gaps


if __name__ == "__main__":
    print("best  (16 Mbps, 30s, 0ms):  ", decide(16, 30, 0))
    print("worst (2 Mbps, 5s, 250ms):  ", decide(2, 5, 250))
    print("mid   (5 Mbps, 14s, 60ms):  ", decide(5, 14, 60))
    print("8 Mbps, 30s, 60ms:          ", decide(8, 30, 60))
    gaps = find_gaps()
    print(f"{len(gaps)} uncovered input combinations", gaps[:10])