
# ANSI转义序列
class ANSI:
    RESET = "\033[0m"
    BLACK = "\033[30m"
    RED = "\033[31m"
    GREEN = "\033[32m"
    YELLOW = "\033[33m"
    BLUE = "\033[34m"
    MAGENTA = "\033[35m"
    CYAN = "\033[36m"
    WHITE = "\033[37m"


# 打印彩色文本的函数
def print_colored_text(text, color):
    print(f"{color}{text}{ANSI.RESET}")


def history_generator(name,engine,result):
    print_colored_text(f'#########{name} result start#########', ANSI.GREEN)
    print_colored_text(result, ANSI.MAGENTA)
    print_colored_text(f'#########{name} result end#########', ANSI.GREEN)
    print_colored_text(f'#########{name} history start#########', ANSI.BLUE)
    print(engine.inspect_history(1000))
    print_colored_text(f'#########{name} history end#########', ANSI.BLUE)