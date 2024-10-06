import os
import re
from datetime import datetime

def find_local_js_files(html_content):
    """Find all locally imported JS files (excluding https) in the HTML content."""
    js_files = []
    script_pattern = re.compile(r'<script\s+src="([^"]+)".*?>', re.IGNORECASE)
    matches = script_pattern.findall(html_content)
    
    for match in matches:
        if not match.startswith("http"):  # Only consider local JS files
            js_files.append(match)
    
    return js_files

def comment_out_js_tags(html_content, js_files):
    """Comment out all <script> tags that import the listed JS files."""
    for js_file in js_files:
        # Modify the pattern to preserve the script tag inside the comment
        html_content = re.sub(
            f'(<script\\s+src="{js_file}".*?</script>)',
            r'<!-- \1 -->',
            html_content,
            flags=re.IGNORECASE
        )
    return html_content

def combine_html_and_js():
    current_dir = os.getcwd()

    # Locate the HTML file
    html_file = None
    for file in os.listdir(current_dir):
        if file.endswith("latent-space.html"):
            html_file = file
            break  # Assuming there's only one HTML file

    if not html_file:
        print("No HTML file found.")
        return

    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")

    # Create the output filename by adding '-assembled' to the original HTML file's name
    output_file = f"{os.path.splitext(html_file)[0]}-assembled-{timestamp}.html"

    # Read the HTML file content
    with open(html_file, 'r', encoding='utf-8') as file:
        html_content = file.read()

    # Find all local JS files mentioned in the HTML <script> tags
    local_js_files_in_html = find_local_js_files(html_content)

    # Find all JS files in the current directory
    js_files_in_directory = [file for file in os.listdir(current_dir) if file.endswith(".js")]

    # Ensure every local JS in the HTML is in the current directory
    missing_js_files = [js_file for js_file in local_js_files_in_html if js_file not in js_files_in_directory]
    if missing_js_files:
        print(f"Error: The following JS files are listed in the HTML but not found in the directory: {missing_js_files}")
        return

    # Comment out the original <script> tags in the HTML
    updated_html_content = comment_out_js_tags(html_content, local_js_files_in_html)

    # Start the combined JS block with a single script tag
    updated_html_content += "\n<!-- Combined JavaScript -->\n"
    updated_html_content += "<script>\n"

    # Add all local JS files inline, with comments for each file name
    for js_file in local_js_files_in_html:
        updated_html_content += f"// {js_file}\n"  # Add the file name as a comment
        with open(js_file, 'r', encoding='utf-8') as file:
            updated_html_content += file.read() + "\n"

    # Close the script tag
    updated_html_content += "</script>\n"

    # Write the combined content to the output file
    with open(output_file, 'w', encoding='utf-8') as file:
        file.write(updated_html_content)

    print(f"Combined HTML and JS into {output_file}")

# Example usage
combine_html_and_js()
