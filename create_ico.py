import os
from PIL import Image

def generate_ico():
    src_path = "assets/marbles/marble_red.png"
    if not os.path.exists(src_path):
        src_path = "assets/frog_idol.jpg"

    img = Image.open(src_path)
    
    # Ensure RGBA
    img = img.convert("RGBA")
    
    # Save as multi-resolution Windows ICO
    ico_path = "assets/app_icon.ico"
    icon_sizes = [(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (16, 16)]
    img.save(ico_path, format="ICO", sizes=icon_sizes)
    print(f"Created {ico_path} successfully!")

if __name__ == "__main__":
    generate_ico()
