import simulate as sim


def small_config():
    return dict(sim.CONFIG, days=35, switch_day=14, seeds=1)


def test_same_arrivals_for_every_policy():
    wards = sim.load_wards()
    days_a, workers_a = sim.build_arrivals(7, wards, small_config())
    days_b, workers_b = sim.build_arrivals(7, wards, small_config())
    ids_a = [[a["report"].id for a in day] for day in days_a]
    ids_b = [[a["report"].id for a in day] for day in days_b]
    assert ids_a == ids_b
    assert [(w.lat, w.lng) for w in workers_a] == [(w.lat, w.lng) for w in workers_b]


def test_policies_match_until_the_switch_day():
    cfg = small_config()
    wards = sim.load_wards()
    days, workers = sim.build_arrivals(7, wards, cfg)
    fcfs = sim.run_policy("fcfs", days, workers, wards, cfg)
    hybrid = sim.run_policy("hybrid_fixed", days, workers, wards, cfg)
    assert fcfs["wait_dep"][: cfg["switch_day"]] == hybrid["wait_dep"][: cfg["switch_day"]]


def test_alpha_stays_inside_bounds():
    cfg = small_config()
    wards = sim.load_wards()
    days, workers = sim.build_arrivals(7, wards, cfg)
    for policy in ("hybrid_gap", "hybrid_backlog"):
        run = sim.run_policy(policy, days, workers, wards, cfg)
        used = [a for a in run["alpha"] if a is not None]
        assert used
        assert all(cfg["alpha_min"] <= a <= cfg["alpha_max"] for a in used)


def test_no_job_is_served_twice():
    cfg = small_config()
    wards = sim.load_wards()
    days, workers = sim.build_arrivals(7, wards, cfg)
    by_id = {a["report"].id: a for day in days for a in day}
    order = list(by_id)[:80]
    served = sim.assign_day(order, by_id, workers, cfg)
    assert len(served) == len(set(served))
    assert all(hours >= 0 for hours in served.values())
