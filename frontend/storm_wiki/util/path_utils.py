import os


def get_demo_dir():
    return os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def get_output_dir():
    output_dir = os.getenv("STREAMLIT_OUTPUT_DIR")
    if not output_dir:
        output_dir = os.path.join(get_demo_dir(), "DEMO_WORKING_DIR")
    os.makedirs(output_dir, exist_ok=True)
    return output_dir
