from app.agent.orchestrator import execute

class ExecutionManager:
    def run(self, command, files):
        return execute(command, files)

execution_manager = ExecutionManager()
