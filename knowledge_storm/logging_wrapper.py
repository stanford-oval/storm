from contextlib import contextmanager
import time
import pytz
from datetime import datetime

# Define California timezone
CALIFORNIA_TZ = pytz.timezone("America/Los_Angeles")


class EventLog:
    def __init__(self, event_name):
        self.event_name = event_name
        self.start_time = None
        self.end_time = None
        self.child_events = {}

    def record_start_time(self):
        self.start_time = datetime.now(
            pytz.utc
        )  # Store in UTC for consistent timezone conversion

    def record_end_time(self):
        self.end_time = datetime.now(
            pytz.utc
        )  # Store in UTC for consistent timezone conversion

    def get_total_time(self):
        if self.start_time and self.end_time:
            return (self.end_time - self.start_time).total_seconds()
        return 0

    def get_start_time(self):
        if self.start_time:
            # Format to milliseconds
            return self.start_time.astimezone(CALIFORNIA_TZ).strftime(
                "%Y-%m-%d %H:%M:%S.%f"
            )[:-3]
        return None

    def get_end_time(self):
        if self.end_time:
            # Format to milliseconds
            return self.end_time.astimezone(CALIFORNIA_TZ).strftime(
                "%Y-%m-%d %H:%M:%S.%f"
            )[:-3]
        return None

    def add_child_event(self, child_event):
        self.child_events[child_event.event_name] = child_event

    def get_child_events(self):
        return self.child_events


class LoggingWrapper:
    def __init__(self, lm_config):
        self.logging_dict = {}
        self.lm_config = lm_config
        self.current_pipeline_stage = None
        self.event_stack = []
        self.pipeline_stage_active = False

    def _pipeline_stage_start(self, pipeline_stage: str):
        if self.pipeline_stage_active:
            raise RuntimeError(
                "A pipeline stage is already active. End the current stage before starting a new one."
            )

        self.current_pipeline_stage = pipeline_stage
        self.logging_dict[pipeline_stage] = {
            "time_usage": {},
            "lm_usage": {},
            "lm_history": [],
            "query_count": 0,
        }
        self.pipeline_stage_active = True

    def _event_start(self, event_name: str):
        if not self.pipeline_stage_active:
            raise RuntimeError("No pipeline stage is currently active.")

        if not self.event_stack and self.current_pipeline_stage:
            # Top-level event (directly under the pipeline stage)
            if (
                event_name
                not in self.logging_dict[self.current_pipeline_stage]["time_usage"]
            ):
                event = EventLog(event_name=event_name)
                event.record_start_time()
                self.logging_dict[self.current_pipeline_stage]["time_usage"][
                    event_name
                ] = event
                self.event_stack.append(event)
            else:
                self.logging_dict[self.current_pipeline_stage]["time_usage"][
                    event_name
                ].record_start_time()
        elif self.event_stack:
            # Nested event (under another event)
            parent_event = self.event_stack[-1]
            if event_name not in parent_event.get_child_events():
                event = EventLog(event_name=event_name)
                event.record_start_time()
                parent_event.add_child_event(event)
                self.logging_dict[self.current_pipeline_stage]["time_usage"][
                    event_name
                ] = event
                self.event_stack.append(event)
            else:
                parent_event.get_child_events()[event_name].record_start_time()
        else:
            raise RuntimeError(
                "Cannot start an event without an active pipeline stage or parent event."
            )

    def _event_end(self, event_name: str):
        if not self.pipeline_stage_active:
            raise RuntimeError("No pipeline stage is currently active.")

        if not self.event_stack:
            raise RuntimeError("No parent event is currently active.")

        if self.event_stack:
            current_event_log = self.event_stack[-1]
            if event_name in current_event_log.get_child_events():
                current_event_log.get_child_events()[event_name].record_end_time()
            elif (
                event_name
                in self.logging_dict[self.current_pipeline_stage]["time_usage"]
            ):
                self.logging_dict[self.current_pipeline_stage]["time_usage"][
                    event_name
                ].record_end_time()
            else:
                raise AssertionError(
                    f"Failure to record end time for event {event_name}. Start time is not recorded."
                )
            if current_event_log.event_name == event_name:
                self.event_stack.pop()
        else:
            raise RuntimeError("Cannot end an event without an active parent event.")

    def _pipeline_stage_end(self):
        if not self.pipeline_stage_active:
            raise RuntimeError("No pipeline stage is currently active to end.")

        self.logging_dict[self.current_pipeline_stage][
            "lm_usage"
        ] = self.lm_config.collect_and_reset_lm_usage()
        self.logging_dict[self.current_pipeline_stage][
            "lm_history"
        ] = self.lm_config.collect_and_reset_lm_history()
        self.pipeline_stage_active = False

    def add_query_count(self, count):
        if not self.pipeline_stage_active:
            raise RuntimeError(
                "No pipeline stage is currently active to add query count."
            )

        self.logging_dict[self.current_pipeline_stage]["query_count"] += count

    @contextmanager
    def log_event(self, event_name):
        if not self.pipeline_stage_active:
            raise RuntimeError("No pipeline stage is currently active.")

        self._event_start(event_name)
        yield
        self._event_end(event_name)

    @contextmanager
    def log_pipeline_stage(self, pipeline_stage):
        if self.pipeline_stage_active:
            print(
                "A pipeline stage is already active, ending the current stage safely."
            )
            self._pipeline_stage_end()

        start_time = time.time()
        try:
            self._pipeline_stage_start(pipeline_stage)
            yield
        except Exception as e:
            print(f"Error occurred during pipeline stage '{pipeline_stage}': {e}")
        finally:
            self.logging_dict[self.current_pipeline_stage]["total_wall_time"] = (
                time.time() - start_time
            )
            self._pipeline_stage_end()

    def dump_logging_and_reset(self, reset_logging=True):
        log_dump = {}
        for pipeline_stage, pipeline_log in self.logging_dict.items():
            time_stamp_log = {
                event_name: {
                    "total_time_seconds": event.get_total_time(),
                    "start_time": event.get_start_time(),
                    "end_time": event.get_end_time(),
                }
                for event_name, event in pipeline_log["time_usage"].items()
            }
            log_dump[pipeline_stage] = {
                "time_usage": time_stamp_log,
                "lm_usage": pipeline_log["lm_usage"],
                "lm_history": pipeline_log["lm_history"],
                "query_count": pipeline_log["query_count"],
                "total_wall_time": pipeline_log["total_wall_time"],
            }
        if reset_logging:
            self.logging_dict.clear()
        return log_dump
