
from app.pdf_processor import extract_text_from_pdf


def main():
    # Call our PDF extraction function.
    pages = extract_text_from_pdf("data/sample.pdf")

    # Display the total number of pages.
    print(f"Total pages: {len(pages)}")

    # Display the first page's extracted text.
    if pages:
        print(f"Page number: {pages[0]['page_number']}")
        print("Extracted text:")
        print(pages[0]["text"][:500])


if __name__ == "__main__":
    main()
