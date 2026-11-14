from fuzzy_engine import decide, find_gaps

def test_no_coverage_gaps():
    assert find_gaps() == []

def test_quality_monotonic_in_bandwidth():
    qs = [decide(bw, 30, 0) for bw in range(0, 17, 2)]
    assert all(b >= a - 1 for a, b in zip(qs, qs[1:])), qs

def test_high_delay_forces_low_quality():
    assert decide(16, 30, 300) < 300