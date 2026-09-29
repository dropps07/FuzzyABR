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

# ---- Bandwidth: based on real observed speeds (2=weak, 5=ok, 8=good, 12-14=best) ----
bandwidth['low'] = fuzz.trapmf(bandwidth.universe, [0, 0, 2, 4])
bandwidth['medium'] = fuzz.trimf(bandwidth.universe, [3, 5, 7])
bandwidth['high'] = fuzz.trimf(bandwidth.universe, [6, 8, 11])
bandwidth['excellent'] = fuzz.trapmf(bandwidth.universe, [10, 13, 16, 16])

# ---- Buffer: seconds of video stored ahead ----
buffer_['draining'] = fuzz.trapmf(buffer_.universe, [0, 0, 3, 8])
buffer_['healthy'] = fuzz.trimf(buffer_.universe, [5, 14, 22])
buffer_['full'] = fuzz.trapmf(buffer_.universe, [18, 25, 30, 30])

# ---- Delay: round-trip time in ms ----
delay['low'] = fuzz.trapmf(delay.universe, [0, 0, 50, 100])
delay['high'] = fuzz.trapmf(delay.universe, [100, 150, 400, 400])

# ---- Output quality levels (standard HLS ladder) ----
quality['panic'] = fuzz.trimf(quality.universe, [144, 144, 280])
quality['low'] = fuzz.trimf(quality.universe, [240, 400, 560])
quality['medium'] = fuzz.trimf(quality.universe, [480, 700, 880])
quality['high'] = fuzz.trimf(quality.universe, [800, 1080, 1080])

# ---- Rules ----
rule_a = ctrl.Rule(delay['high'], quality['panic'])
rule_b = ctrl.Rule(buffer_['draining'], quality['low'])
rule_c = ctrl.Rule(bandwidth['low'], quality['low'])
rule_d = ctrl.Rule(bandwidth['excellent'] & buffer_['full'] & delay['low'], quality['high'])
rule_e = ctrl.Rule(bandwidth['high'] & buffer_['healthy'] & delay['low'], quality['medium'])
rule_f = ctrl.Rule(bandwidth['medium'] & buffer_['healthy'], quality['medium'])

_system = ctrl.ControlSystem([rule_a, rule_b, rule_c, rule_d, rule_e, rule_f])


def decide(bw, buf, dly):
    sim = ctrl.ControlSystemSimulation(_system)
    sim.input['bandwidth'] = np.clip(bw, 0, 16)
    sim.input['buffer'] = np.clip(buf, 0, 30)
    sim.input['delay'] = np.clip(dly, 0, 400)
    sim.compute()
    if 'quality' not in sim.output:
        return 360.0
    return round(sim.output['quality'], 2)


if __name__ == "__main__":
    print("best case (14 Mbps, buffer 26s, delay 30ms):", decide(14, 26, 30))
    print("worst case (2 Mbps, buffer 5s, delay 250ms):", decide(2, 5, 250))
    print("mid case (5 Mbps, buffer 14s, delay 60ms):", decide(5, 14, 60))