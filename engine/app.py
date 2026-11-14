"""
FuzzyABR - Flask API
Exposes the fuzzy engine over HTTP for the React client.
"""

import os

from flask import Flask, request, jsonify
from flask_cors import CORS

from fuzzy_engine import _system, decide

app = Flask(__name__)
CORS(app)

FALLBACK_QUALITY = 360.0


def parse_inputs(data):
    """Validate and clamp the three inputs. Raises KeyError/TypeError/ValueError."""
    if not isinstance(data, dict):
        raise TypeError('JSON body must be an object')
    bandwidth = max(0.0, min(16.0, float(data['bandwidth'])))
    buffer_ = max(0.0, min(30.0, float(data['buffer'])))
    delay = max(0.0, min(400.0, float(data['delay'])))
    return bandwidth, buffer_, delay


@app.post('/api/network-status')
@app.post('/get-quality')  # old route kept so nothing else breaks
def network_status():
    try:
        bandwidth, buffer_, delay = parse_inputs(request.get_json(silent=True))
    except (KeyError, TypeError, ValueError) as e:
        return jsonify({'error': f'Bad input: {e!r}'}), 400

    try:
        result = decide(bandwidth, buffer_, delay)
    except Exception as e:
        app.logger.exception('fuzzy engine failed')
        return jsonify({'error': str(e)}), 500

    inputs = {'bandwidth': bandwidth, 'buffer': buffer_, 'delay': delay}

    # decide() returns None when no rule fires (a coverage gap).
    # Say so honestly instead of labelling a default as an engine decision.
    if result is None:
        return jsonify({'quality': FALLBACK_QUALITY, 'source': 'fallback', 'inputs': inputs})

    return jsonify({'quality': result, 'source': 'fuzzy_engine', 'inputs': inputs})


@app.get('/health')
def health():
    return jsonify({'status': 'ok'}), 200


@app.get('/rules')
def get_rules():
    rules_list = list(_system.rules)
    return jsonify({
        'inputs': ['bandwidth (Mbps)', 'buffer (seconds)', 'delay (ms)'],
        'output': 'quality (144-1080)',
        'rule_count': len(rules_list),
        'rules': [str(r) for r in rules_list],
    }), 200


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8000))
    # 127.0.0.1: only your machine can reach it. Use 0.0.0.0 only inside Docker.
    app.run(host=os.environ.get('HOST', '127.0.0.1'), port=port, debug=False)