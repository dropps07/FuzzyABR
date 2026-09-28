import numpy as np
import skfuzzy as fuzz
from skfuzzy import control as ctrl

bandwidth = ctrl.Antecedent(np.arange(0, 10.01, 0.1),'bandwidth')
buffer = ctrl.Antecedent(np.arange(0, 30.01, 1), 'buffer')
delay = ctrl.Antecedent(np.arange(0, 400.01, 1), 'delay')
quality = ctrl.Consequent(np.arange(0, 1201, 1), 'quality')

bandwidth['high'] = fuzz.trapmf(bandwidth.universe, [6,8,10,10])
bandwidth['low'] = fuzz.trapmf(bandwidth.universe, [0,0,2,4])
bandwidth['medium'] = fuzz.trimf(bandwidth.universe, [3,5,7])

quality['high'] = fuzz.trapmf(quality.universe,[840, 1080, 1200, 1200])
quality['medium'] = fuzz.trimf(quality.universe, [480, 720, 840])
quality['low'] = fuzz.trapmf(quality.universe,[144, 240 ,360 ,480 ])
quality['panic'] = fuzz.trimf(quality.universe,[144,144, 240 ])


buffer['empty'] = fuzz.trimf(buffer.universe, [0,0,3])
buffer['half'] = fuzz.trimf(buffer.universe, [2, 5, 8])
buffer['full'] = fuzz.trapmf(buffer.universe, [10,20,30,30])

delay['spike'] = fuzz.trapmf(delay.universe, [330, 370, 400, 400])
delay['low'] = fuzz.trapmf(delay.universe, [40, 80, 100, 120])
delay['moderate'] = fuzz.trimf(delay.universe, [110, 160, 210])
delay['high'] = fuzz.trapmf(delay.universe, [190, 210, 270, 350])
delay['very_low'] = fuzz.trapmf(delay.universe, [0, 0, 50, 100])

rule_a = ctrl.Rule(delay['spike'], quality['panic'])
rule_b = ctrl.Rule(buffer['empty'] | bandwidth['low'], quality['low'])
rule_c = ctrl.Rule(delay['high'], quality['low'])
rule_d = ctrl.Rule(bandwidth['medium'] & buffer['half'] & (delay['very_low'] | delay['low'] | delay['moderate']), quality['medium'])
rule_e = ctrl.Rule(bandwidth['high'] & buffer['full'] & (delay['very_low'] | delay['low']), quality['high'])
rule_f = ctrl.Rule(bandwidth['high'] & buffer['half'] & (delay['very_low'] | delay['low']), quality['medium'])
rule_g = ctrl.Rule(bandwidth['medium'] & delay['high'], quality['low'])

_system = ctrl.ControlSystem([rule_a, rule_b, rule_c, rule_d, rule_e, rule_f, rule_g])

def decide(bw, buf, dly):
    sim = ctrl.ControlSystemSimulation(_system)
    sim.input['bandwidth']= bw
    sim.input['buffer']= buf
    sim.input['delay']= dly
    sim.compute()
    return sim.output['quality']
print(decide(8, 20, 50))