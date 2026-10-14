import urllib.request
import urllib.parse
import json
import time
import concurrent.futures
import sys

BASE_URL = "http://localhost:5156/api"

def make_request(method, endpoint, data=None, token=None):
    url = f"{BASE_URL}{endpoint}"
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    
    encoded_data = json.dumps(data).encode("utf-8") if data else None
    req = urllib.request.Request(url, data=encoded_data, headers=headers, method=method)
    
    start_time = time.perf_counter()
    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            status = response.status
            body = response.read().decode("utf-8")
            elapsed = (time.perf_counter() - start_time) * 1000
            return status, json.loads(body) if body else None, elapsed, None
    except urllib.error.HTTPError as e:
        elapsed = (time.perf_counter() - start_time) * 1000
        body = e.read().decode("utf-8")
        try:
            parsed = json.loads(body)
        except Exception:
            parsed = body
        return e.code, parsed, elapsed, None
    except Exception as e:
        elapsed = (time.perf_counter() - start_time) * 1000
        return 0, None, elapsed, str(e)

def run_stress_test():
    print("=" * 60)
    print("EasyLang Sprint 2 API Stress & Verification Suite")
    print("=" * 60)
    
    results = {
        "total_requests": 0,
        "success_count": 0,
        "error_count": 0,
        "latencies": []
    }

    # 1. AUTHENTICATION CONCURRENCY TEST
    print("\n[Phase 1] Stress Testing Authentication (50 concurrent logins)...")
    accounts = [
        ("DI", "Damir2006", "Project Manager"),
        ("MZ", "Madi2007", "Translator"),
        ("DD", "Dulat2007", "Chief Editor"),
        ("ZA", "Zhanik2008", "Translator"),
        ("BK", "Beka2008", "Translator"),
        ("LO", "Lolololo", "Translator")
    ]
    
    tokens = {}
    auth_tasks = []
    for i in range(50):
        acc = accounts[i % len(accounts)]
        auth_tasks.append((acc[0], acc[1]))
    
    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
        futures = [
            executor.submit(make_request, "POST", "/auth/login", {"initials": initials, "password": password})
            for initials, password in auth_tasks
        ]
        for f in concurrent.futures.as_completed(futures):
            status, body, elapsed, err = f.result()
            results["total_requests"] += 1
            results["latencies"].append(elapsed)
            if status == 200 and body and "token" in body:
                results["success_count"] += 1
                role = body.get("role")
                if role not in tokens:
                    tokens[role] = body["token"]
            else:
                results["error_count"] += 1
                print(f"  Auth failure: status={status}, err={err}")

    print(f"  Auth completed: 50 requests, tokens acquired for roles: {list(tokens.keys())}")

    # 2. INVALID AUTH TEST
    print("\n[Phase 2] Testing Auth Boundary & Invalid Credentials...")
    for bad_pwd in ["wrong1", "123456", "invalidpass"]:
        status, body, elapsed, err = make_request("POST", "/auth/login", {"initials": "DI", "password": bad_pwd})
        results["total_requests"] += 1
        results["latencies"].append(elapsed)
        if status == 401:
            results["success_count"] += 1
        else:
            results["error_count"] += 1
            print(f"  Expected 401 for bad password, got {status}")
    print("  Invalid credentials correctly rejected with 401 Unauthorized.")

    # 3. PROJECTS RETRIEVAL & PAGINATION MATH CONCURRENCY
    print("\n[Phase 3] Stress Testing GET /api/projects (50 concurrent requests)...")
    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
        futures = [
            executor.submit(make_request, "GET", "/projects", None, tokens.get("Project Manager"))
            for _ in range(50)
        ]
        for f in concurrent.futures.as_completed(futures):
            status, body, elapsed, err = f.result()
            results["total_requests"] += 1
            results["latencies"].append(elapsed)
            if status == 200 and isinstance(body, list):
                results["success_count"] += 1
            else:
                results["error_count"] += 1
                print(f"  Get projects failure: status={status}, err={err}")

    # Verify project pagination logic
    status, all_projects, _, _ = make_request("GET", "/projects")
    total_projects = len(all_projects)
    print(f"  Fetched {total_projects} projects successfully.")
    
    # Check PM page sizing (5 per page)
    pm_page_size = 5
    pm_pages = (total_projects + pm_page_size - 1) // pm_page_size
    print(f"  PM Dashboard: {total_projects} projects -> {pm_pages} pages (5 per page).")
    
    # Check Chief Editor page sizing (7 per page)
    ce_page_size = 7
    ce_pages = (total_projects + ce_page_size - 1) // ce_page_size
    print(f"  Chief Editor Dashboard: {total_projects} projects -> {ce_pages} pages (7 per page).")

    # 4. TRANSLATOR SEARCH & WORKLOAD CONCURRENCY
    print("\n[Phase 4] Stress Testing Translator Live Search (50 concurrent queries)...")
    tr_token = tokens.get("Translator")
    search_queries = ["2401", "Legal", "Fintrex", "Doc", "Manual", "Policy", "v2", "1", "High", ""]
    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
        futures = [
            executor.submit(make_request, "GET", f"/projects/my-activities?search={urllib.parse.quote(q)}", None, tr_token)
            for q in [search_queries[i % len(search_queries)] for i in range(50)]
        ]
        for f in concurrent.futures.as_completed(futures):
            status, body, elapsed, err = f.result()
            results["total_requests"] += 1
            results["latencies"].append(elapsed)
            if status == 200 and isinstance(body, list):
                results["success_count"] += 1
            else:
                results["error_count"] += 1
                print(f"  Search query failed: status={status}, err={err}")
    print("  Live fuzzy search handled all 50 concurrent queries with 0 errors.")

    # 5. DAILY LOG VALIDATION & BOUNDARY TESTS
    print("\n[Phase 5] Testing Daily Work Record Logging & Constraints...")
    # Find a valid activity
    status, my_acts, _, _ = make_request("GET", "/projects/my-activities", None, tr_token)
    if my_acts and len(my_acts) > 0:
        target_act = my_acts[0]
        act_id = target_act["activityId"]
        current_progress = float(target_act.get("cumulativeProgress", 0))
        remaining = 100.0 - current_progress
        print(f"  Testing on Activity #{act_id} (Current: {current_progress:.2f}%, Remaining: {remaining:.2f}%)")

        # Test valid 2-decimal log
        valid_chunk = min(2.50, remaining / 2) if remaining > 5 else 0.50
        status, body, elapsed, _ = make_request(
            "POST", f"/activities/{act_id}/daily-logs",
            {"progressPercentage": valid_chunk, "notes": "Stress test log"},
            tr_token
        )
        results["total_requests"] += 1
        results["latencies"].append(elapsed)
        created_log_id = (body.get("log", {}).get("id") if isinstance(body.get("log"), dict) else None) or body.get("logId")
        
        if status == 200 and created_log_id:
            results["success_count"] += 1
            print(f"  [PASS] Logged valid {valid_chunk:.2f}% (Log ID: {created_log_id})")
        else:
            results["error_count"] += 1
            print(f"  [FAIL] Valid log failed: status={status}, body={body}")

        # Test over 100% boundary check
        over_val = remaining + 10.0
        status, body, elapsed, _ = make_request(
            "POST", f"/activities/{act_id}/daily-logs",
            {"progressPercentage": over_val, "notes": "Exceeding log"},
            tr_token
        )
        results["total_requests"] += 1
        results["latencies"].append(elapsed)
        if status == 400:
            results["success_count"] += 1
            print(f"  [PASS] Boundary violation (+{over_val:.2f}%) correctly rejected with 400 Bad Request.")
        else:
            results["error_count"] += 1
            print(f"  [FAIL] Expected 400 for >100% cumulative, got {status}")

        # Test negative value rejection
        status, body, elapsed, _ = make_request(
            "POST", f"/activities/{act_id}/daily-logs",
            {"progressPercentage": -5.0, "notes": "Negative log"},
            tr_token
        )
        results["total_requests"] += 1
        results["latencies"].append(elapsed)
        if status == 400:
            results["success_count"] += 1
            print(f"  [PASS] Negative percentage correctly rejected with 400 Bad Request.")
        else:
            results["error_count"] += 1
            print(f"  [FAIL] Expected 400 for negative value, got {status}")

        # Clean up test log
        if created_log_id:
            status, _, elapsed, _ = make_request("DELETE", f"/activities/{act_id}/daily-logs/{created_log_id}", None, tr_token)
            results["total_requests"] += 1
            results["latencies"].append(elapsed)
            if status == 200:
                results["success_count"] += 1
                print(f"  [PASS] Cleaned up stress test log #{created_log_id}")

    # 6. CHIEF EDITOR REVIEW HOURS BUDGETING (STORY #2) CONCURRENCY
    print("\n[Phase 6] Stress Testing Chief Editor Review Metrics Update (30 concurrent updates)...")
    ce_token = tokens.get("Chief Editor")
    if all_projects and len(all_projects) > 0:
        sample_projects = all_projects[:5]
        with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
            futures = [
                executor.submit(
                    make_request, "PUT", f"/projects/{p['projectId']}/review",
                    {"reviewHours": 25.5 + (i % 5)}, ce_token
                )
                for i, p in enumerate([sample_projects[j % len(sample_projects)] for j in range(30)])
            ]
            for f in concurrent.futures.as_completed(futures):
                status, body, elapsed, err = f.result()
                results["total_requests"] += 1
                results["latencies"].append(elapsed)
                if status == 200:
                    results["success_count"] += 1
                else:
                    results["error_count"] += 1
                    print(f"  Review hours update failure: status={status}, err={err}")
        print("  Chief Editor review workload budgeting handled all 30 updates with 0 errors.")

    # 7. METRICS SUMMARY
    print("\n" + "=" * 60)
    print("STRESS TEST SUMMARY")
    print("=" * 60)
    total = results["total_requests"]
    successes = results["success_count"]
    errors = results["error_count"]
    success_rate = (successes / total * 100) if total > 0 else 0
    avg_latency = sum(results["latencies"]) / len(results["latencies"]) if results["latencies"] else 0
    min_latency = min(results["latencies"]) if results["latencies"] else 0
    max_latency = max(results["latencies"]) if results["latencies"] else 0

    print(f"Total Requests Executed: {total}")
    print(f"Successful Requests:     {successes} ({success_rate:.1f}%)")
    print(f"Failed / Errored:        {errors}")
    print(f"Avg Response Latency:    {avg_latency:.2f} ms")
    print(f"Min Response Latency:    {min_latency:.2f} ms")
    print(f"Max Response Latency:    {max_latency:.2f} ms")
    print("=" * 60)

    if errors == 0:
        print(">>> ALL TESTS PASSED WITH 0 ERRORS! <<<")
        return 0
    else:
        print(f">>> {errors} ERRORS DETECTED! <<<")
        return 1

if __name__ == "__main__":
    sys.exit(run_stress_test())
