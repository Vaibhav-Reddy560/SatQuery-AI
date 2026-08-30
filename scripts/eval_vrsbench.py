import os
import sys
import json

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.app.ml.vrsbench_eval import vrsbench_evaluator

def main():
    print("=" * 60)
    print(" SatQuery AI - VRSBench Remote Sensing MLOps Evaluator ")
    print(" Benchmark Paper: VRSBench (Vision-Language Remote Sensing)")
    print("=" * 60)
    
    results = vrsbench_evaluator.run_evaluation_suite()
    print("\n[+] Evaluation Summary:")
    print(json.dumps(results["metrics"], indent=2))
    
    print("\n[+] Task Performance Breakdown:")
    for task, data in results["task_breakdown"].items():
        print(f"  * {task}: {data}")

    print("\n[+] MLOps benchmark evaluation complete!")

if __name__ == "__main__":
    main()
