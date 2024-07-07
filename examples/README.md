# Examples

We host a number of example scripts for various customization of STORM (e.g., use your favorite language models, use your own corpus, etc.). These examples can be starting points for your own customizations and you are welcome to contribute your own examples by submitting a pull request to this directory.

## Run STORM with your own language model
[run_storm_wiki_gpt.py](run_storm_wiki_gpt.py) provides an example of running STORM with GPT models, and [run_storm_wiki_claude.py](run_storm_wiki_claude.py) provides an example of running STORM with Claude models. Besides using close-source models, you can also run STORM with models with open weights.

`run_storm_wiki_mistral.py` provides an example of running STORM with `Mistral-7B-Instruct-v0.2` using [VLLM](https://docs.vllm.ai/en/stable/) server:

1. Set up a VLLM server with the `Mistral-7B-Instruct-v0.2` model running.
2. Run the following command under the root directory of the repository:

   ```
    python examples/run_storm_wiki_mistral.py \
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

Besides VLLM server, STORM is also compatible with [TGI](https://huggingface.co/docs/text-generation-inference/en/index) server or [Together.ai](https://www.together.ai/products#inference) endpoint. 


## Run STORM with your own corpus

By default, STORM is grounded on the Internet using the search engine, but it can also be grounded on your own corpus using `VectorRM`. [run_storm_wiki_with_gpt_with_VectorRM.py](run_storm_wiki_gpt_with_VectorRM.py) provides an example of running STORM grounding on your provided data.

1. Set up API keys.
   - Make sure you have set up the OpenAI API key.
   - `VectorRM` use [Qdrant](https://github.com/qdrant/qdrant-client) to create a vector store. If you want to set up this vector store online on a [Qdrant cloud server](https://cloud.qdrant.io/login), you need to set up `QDRANT_API_KEY` in `secrets.toml` as well; if you want to save the vector store locally, make sure you provide a location for the vector store.
2. Prepare your corpus. The documents should be provided as a single CSV file with the following format:

   | content                | title      | url        | description                        |
   |------------------------|------------|------------|------------------------------------|
   | I am a document.       | Document 1 | docu-n-112 | A self-explanatory document.       |
   | I am another document. | Document 2 | docu-l-13  | Another self-explanatory document. |
   | ...                    | ...        | ...        | ...                                |

   - `url` will be used as a unique identifier of the document in STORM engine, so ensure different documents have different urls.
   - The contents for `title` and `description` columns are optional. If not provided, the script will use default empty values.
   - The content column is crucial and should be provided for each document.

3. Run the command under the root directory of the repository:
   To create the vector store offline, run

   ```
   python examples/run_storm_wiki_gpt_with_VectorRM.py \
       --output-dir $OUTPUT_DIR \
       --vector-db-mode offline \
       --offline-vector-db-dir $OFFLINE_VECTOR_DB_DIR \
       --update-vector-store \
       --csv-file-path $CSV_FILE_PATH \ 
       --device $DEVICE_FOR_EMBEDDING(mps, cuda, cpu) \
       --do-research \
       --do-generate-outline \
       --do-generate-article \
       --do-polish-article
   ```

   To create the vector store online on a Qdrant server, run

   ```
   python examples/run_storm_wiki_gpt_with_VectorRM.py \
       --output-dir $OUTPUT_DIR \
       --vector-db-mode online \
       --online-vector-db-url $ONLINE_VECTOR_DB_URL \
       --update-vector-store \
       --csv-file-path $CSV_FILE_PATH \
       --device $DEVICE_FOR_EMBEDDING(mps, cuda, cpu) \
       --do-research \
       --do-generate-outline \
       --do-generate-article \
       --do-polish-article
   ```

4. **Quick test with Kaggle arXiv Paper Abstracts dataset**:
   
   - Download `arxiv_data_210930-054931.csv` from [here](https://www.kaggle.com/datasets/spsayakpaul/arxiv-paper-abstracts).
   - Run the following command under the root directory to downsample the dataset by filtering papers with terms `[cs.CV]` and get a csv file that match the format mentioned above.

     ```
     python examples/helper/process_kaggle_arxiv_abstract_dataset --input-path $PATH_TO_THE_DOWNLOADED_FILE --output-path $PATH_TO_THE_PROCESSED_CSV
     ```
   - Run the following command to run STORM grounding on the processed dataset. You can input a topic related to computer vision (e.g., "The progress of multimodal models in computer vision") to see the generated article. (Note that the generated article may not include enough details since the quick test only use the abstracts of arxiv papers.)

     ```
     python examples/run_storm_wiki_gpt_with_VectorRM.py \
         --output-dir $OUTPUT_DIR \
         --vector-db-mode offline \
         --offline-vector-db-dir $OFFLINE_VECTOR_DB_DIR \
         --update-vector-store \
         --csv-file-path $PATH_TO_THE_PROCESSED_CSV \
         --device $DEVICE_FOR_EMBEDDING(mps, cuda, cpu) \
         --do-research \
         --do-generate-outline \
         --do-generate-article \
         --do-polish-article
     ```
   - For a quicker run, you can also download the pre-embedded vector store directly from [here](https://drive.google.com/file/d/1bijFkw5BKU7bqcmXMhO-5hg2fdKAL9bf/view?usp=share_link).

     ```
     python examples/run_storm_wiki_gpt_with_VectorRM.py \
         --output-dir $OUTPUT_DIR \
         --vector-db-mode offline \
         --offline-vector-db-dir $DOWNLOADED_VECTOR_DB_DR \
         --do-research \
         --do-generate-outline \
         --do-generate-article \
         --do-polish-article
     ```