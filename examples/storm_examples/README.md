<!--
  这是 STORM 示例脚本目录的 README。
  学习路线: 从这里了解 STORM 支持哪些定制方式，然后选一个示例脚本入手。
  两种主要定制方式:
    1. 换 LLM: 用你自己喜欢的语言模型（如 MiniMax M3）
    2. 换检索源: 用你自己的语料库代替互联网搜索
-->

# Examples

We host a number of example scripts for various customization of STORM (e.g., use your favorite language models, use your own corpus, etc.). These examples can be starting points for your own customizations and you are welcome to contribute your own examples by submitting a pull request to this directory.

<!--
  以下示例脚本覆盖了几种典型场景:
  ┌──────────────────────────────────────────────────────────┐
  │ 场景                    │ 脚本                           │
  ├──────────────────────────┼───────────────────────────────┤
  │ 闭源 LLM (GPT/Claude)    │ run_storm_wiki_gpt/claude.py  │
  │ 开源 LLM (Mistral 等)    │ run_storm_wiki_mistral/ollama │
  │ 自定义检索 (自己语料)     │ run_storm_wiki_gpt_with_VectorRM │
  │ 免费搜索 (DuckDuckGo)    │ --retriever duckduckgo        │
  └──────────────────────────────────────────────────────────┘
-->

## Run STORM with your own language model

<!--
  两类模型运行方式:
  1. 闭源模型(GPT/Claude): 直接传入 API Key，调云端 API
  2. 开源模型(Mistral/LLaMA): 需要先本地起推理服务器(vLLM/TGI)，再连过去
-->

[run_storm_wiki_gpt.py](run_storm_wiki_gpt.py) provides an example of running STORM with GPT models, and [run_storm_wiki_claude.py](run_storm_wiki_claude.py) provides an example of running STORM with Claude models. Besides using close-source models, you can also run STORM with models with open weights.

`run_storm_wiki_mistral.py` provides an example of running STORM with `Mistral-7B-Instruct-v0.2` using [VLLM](https://docs.vllm.ai/en/stable/) server:

<!--
  运行步骤:
  1. 用 vLLM 启动 Mistral 推理服务
  2. 运行示例脚本 → STORM 通过 HTTP 调本地 vLLM 的 /v1/chat/completions
-->

1. Set up a VLLM server with the `Mistral-7B-Instruct-v0.2` model running.
2. Run the following command under the root directory of the repository:

   ```
    python examples/storm_examples/run_storm_wiki_mistral.py \
       --url $URL \
       --port $PORT \
       --output-dir $OUTPUT_DIR \
       --retriever you \
       --do-research \
       --do-generate-outline \
       --do-generate-article \
       --do-polish-article
    ```
   - `--url` URL of the VLLM server.
   - `--port` Port of the VLLM server.

<!--
  TGI: HuggingFace 的推理框架，类似 vLLM
  Together.ai: 托管的开源模型推理云平台，按使用量计费
  这些都能用 VLLMClient/TogetherClient 连接（见 lm.py 中对应类）
-->

Besides VLLM server, STORM is also compatible with [TGI](https://huggingface.co/docs/text-generation-inference/en/index) server or [Together.ai](https://www.together.ai/products#inference) endpoint. 


## Run STORM with your own corpus

<!--
  默认模式 vs 自定义语料模式:
  
  默认: 用户给 Topic → STORM 上网搜索 → 收集信息 → 写文章
  自定义: 用户给 Topic → STORM 搜你的本地文档 → 收集信息 → 写文章
  
  关键组件: VectorRM（向量检索模块），用 Qdrant 向量数据库存储和检索文档
  Qdrant 可以两种模式部署:
    - offline: 向量数据存本地文件夹，简单直接
    - online: 向量数据存 Qdrant 云服务器，适合团队共享
-->

By default, STORM is grounded on the Internet using the search engine, but it can also be grounded on your own corpus using `VectorRM`. [run_storm_wiki_with_gpt_with_VectorRM.py](run_storm_wiki_gpt_with_VectorRM.py) provides an example of running STORM grounding on your provided data.

<!-- 前置准备步骤: API Key 配置 + Qdrant 配置 -->

1. Set up API keys.
   - Make sure you have set up the OpenAI API key.
   - `VectorRM` use [Qdrant](https://github.com/qdrant/qdrant-client) to create a vector store. If you want to set up this vector store online on a [Qdrant cloud server](https://cloud.qdrant.io/login), you need to set up `QDRANT_API_KEY` in `secrets.toml` as well; if you want to save the vector store locally, make sure you provide a location for the vector store.

<!--
  CSV 文件格式说明:
  ┌──────────────┬──────────┬────────────┬────────────┐
  │ content      │ title    │ url        │ description│
  ├──────────────┼──────────┼────────────┼────────────┤
  │ 文档正文     │ 文档标题  │ 唯一标识符  │ 文档描述    │
  │ (必填)       │ (可选)    │ (必填+唯一) │ (可选)     │
  └──────────────┴──────────┴────────────┴────────────┘
  
  注意: url 字段在 STORM 引擎内部用作文档的唯一标识符，
       所以不同文档必须有不同的 url。
-->

2. Prepare your corpus. The documents should be provided as a single CSV file with the following format:

   | content                | title      | url        | description                        |
   |------------------------|------------|------------|------------------------------------|
   | I am a document.       | Document 1 | docu-n-112 | A self-explanatory document.       |
   | I am another document. | Document 2 | docu-l-13  | Another self-explanatory document. |
   | ...                    | ...        | ...        | ...                                |

   - `url` will be used as a unique identifier of the document in STORM engine, so ensure different documents have different urls.
   - The contents for `title` and `description` columns are optional. If not provided, the script will use default empty values.
   - The content column is crucial and should be provided for each document.

<!--
  两种 Qdrant 部署模式对比:
  
  offline 模式:
    - 向量数据存本地硬盘 (--offline-vector-db-dir 指定目录)
    - 适合个人开发、快速测试
    - 需要指定 --device 来选择 embedding 设备 (mps/cuda/cpu)
  
  online 模式:
    - 向量数据存 Qdrant 云服务器 (--online-vector-db-url 指定地址)
    - 适合团队协作、生产环境
    - 需要先配 QDRANT_API_KEY
-->

3. Run the command under the root directory of the repository:
   To create the vector store offline, run

   ```
   python examples/storm_examples/run_storm_wiki_gpt_with_VectorRM.py \
       --output-dir $OUTPUT_DIR \
       --vector-db-mode offline \
       --offline-vector-db-dir $OFFLINE_VECTOR_DB_DIR \
       --csv-file-path $CSV_FILE_PATH \ 
       --device $DEVICE_FOR_EMBEDDING(mps, cuda, cpu) \
       --do-research \
       --do-generate-outline \
       --do-generate-article \
       --do-polish-article
   ```

   To create the vector store online on a Qdrant server, run

   ```
   python examples/storm_examples/run_storm_wiki_gpt_with_VectorRM.py \
       --output-dir $OUTPUT_DIR \
       --vector-db-mode online \
       --online-vector-db-url $ONLINE_VECTOR_DB_URL \
       --csv-file-path $CSV_FILE_PATH \
       --device $DEVICE_FOR_EMBEDDING(mps, cuda, cpu) \
       --do-research \
       --do-generate-outline \
       --do-generate-article \
       --do-polish-article
   ```

<!--
  Kaggle 快速测试: 用 arXiv 论文摘要数据集快速体验自定义语料功能
  流程: 下载数据 → 过滤处理 → 建向量库 → 跑 STORM
  注意: 论文摘要信息量有限，生成的文章可能不够详细
-->

4. **Quick test with Kaggle arXiv Paper Abstracts dataset**:
   
   - Download `arxiv_data_210930-054931.csv` from [here](https://www.kaggle.com/datasets/spsayakpaul/arxiv-paper-abstracts).
   - Run the following command under the root directory to downsample the dataset by filtering papers with terms `[cs.CV]` and get a csv file that match the format mentioned above.

     ```
     python examples/storm_examples/helper/process_kaggle_arxiv_abstract_dataset.py --input-path $PATH_TO_THE_DOWNLOADED_FILE --output-path $PATH_TO_THE_PROCESSED_CSV
     ```
   - Run the following command to run STORM grounding on the processed dataset. You can input a topic related to computer vision (e.g., "The progress of multimodal models in computer vision") to see the generated article. (Note that the generated article may not include enough details since the quick test only use the abstracts of arxiv papers.)

     ```
     python examples/storm_examples/run_storm_wiki_gpt_with_VectorRM.py \
         --output-dir $OUTPUT_DIR \
         --vector-db-mode offline \
         --offline-vector-db-dir $OFFLINE_VECTOR_DB_DIR \
         --csv-file-path $PATH_TO_THE_PROCESSED_CSV \
         --device $DEVICE_FOR_EMBEDDING(mps, cuda, cpu) \
         --do-research \
         --do-generate-outline \
         --do-generate-article \
         --do-polish-article
     ```
   - For a quicker run, you can also download the pre-embedded vector store directly from [here](https://drive.google.com/file/d/1bijFkw5BKU7bqcmXMhO-5hg2fdKAL9bf/view?usp=share_link).

     ```
     python examples/storm_examples/run_storm_wiki_gpt_with_VectorRM.py \
         --output-dir $OUTPUT_DIR \
         --vector-db-mode offline \
         --offline-vector-db-dir $DOWNLOADED_VECTOR_DB_DR \
         --do-research \
         --do-generate-outline \
         --do-generate-article \
         --do-polish-article
     ```
