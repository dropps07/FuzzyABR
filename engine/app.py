"""
FuzzyABR - Flask API
Exposes the fuzzy engine over HTTP so the server/client can call it.
"""

from fuzzy_engine import _system, decide
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

@app.route('/get-quality', methods=['POST'])
def get_quality():
    try: 
        data = request.json
        
        bandwidth_input = float(max(0, min(16, data['bandwidth'])))
        buffer_input = float(max(0, min(30, data['buffer'])))
        delay_input = float(max(0, min(400, data['delay'])))

        result = decide(bandwidth_input, buffer_input, delay_input)

        return jsonify({
            'quality': result,
            'inputs': {'bandwidth': bandwidth_input, 'buffer':buffer_input, 'delay': delay_input}
        })
    except(KeyError, TypeError, ValueError) as e:
        return jsonify({'error': f'Bad Input: {str(e)}'}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok'}), 200

@app.route('/rules', methods=['GET'])
def get_rules():
    rules_list = list(_system.rules)
    return jsonify({
        'inputs': ['bandwidth (Mbps)', 'buffer (seconds)', 'delay (ms)'],
        'output': 'quality (144-1080)',
        'rule_count': len(rules_list),
        'rules': [str(r) for r in rules_list],
    }), 200

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug= True)