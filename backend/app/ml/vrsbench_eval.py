"""
VRSBench (Visual Remote Sensing Benchmark) — evaluation status.

SatQuery does NOT currently evaluate its VLM against the VRSBench benchmark:
no inference has been run against the benchmark, so NO benchmark metrics are
reported. Fabricating metrics here would be scientifically dishonest, so this
module only reports that the benchmark is not available and describes the
tasks it would cover. No random or invented numbers are ever returned.
"""

from typing import Dict, Any, List


class VRSBenchEvaluator:
    """
    VRSBench evaluation status. The benchmark is NOT evaluated in this
    project; the endpoint exists only to state that fact honestly.
    """

    BENCHMARK_TASKS: List[str] = [
        "Visual Question Answering (VQA)",
        "Remote Sensing Image Captioning",
        "Object Grounding & Bounding Box Localization",
        "Multi-band Change Verification",
    ]

    def run_evaluation_suite(self) -> Dict[str, Any]:
        """Honest status: the benchmark has not been evaluated here."""
        return {
            "benchmark": "VRSBench Remote Sensing Evaluation Suite",
            "status": "NOT_AVAILABLE",
            "evaluated": False,
            "message": (
                "VRSBench is not evaluated in this deployment: no metrics are "
                "reported because none were measured. SatQuery's vision-language "
                "model has not been run against the VRSBench benchmark."
            ),
            "tasks": self.BENCHMARK_TASKS,
            "metrics": None,
        }


vrsbench_evaluator = VRSBenchEvaluator()