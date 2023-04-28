import PIL.Image as Image
from PIL import ImageDraw, ImageFont
import os
import re


IMAGES_PATH = r'tl/'  # 图片集地址
IMAGES_FORMAT = ['.png']  # 图片格式
IMAGE_SIZE = [0, 0]  # 每张小图片的大小
IMAGE_ROW = 3  # 图片间隔，也就是合并成一张图后，一共有几行
IMAGE_COLUMN = 6  # 图片间隔，也就是合并成一张图后，一共有几列
IMAGE_SAVE_PATH = r'A.png'  # 图片转换后的地址
 
# 获取图片集地址下的所有图片名称
image_names = [name for name in os.listdir(IMAGES_PATH) for item in IMAGES_FORMAT if
               os.path.splitext(name)[1] == item]
 
# 简单的对于参数的设定和实际图片集的大小进行数量判断
if len(image_names) != IMAGE_ROW * IMAGE_COLUMN:
    raise ValueError("合成图片的参数和要求的数量不能匹配！")
 
offset = 200
fz = 60

# 定义图像拼接函数
def image_compose():
    global IMAGE_SIZE
    font = ImageFont.truetype(r'C:\Users\Administrator\Documents\bot_irori\Assets\sarasa-gothic-ttf-0.12.5\sarasa-ui-tc-bold.ttf', fz)

    # 循环遍历，把每张图片按顺序粘贴到对应位置上
    for y in range(IMAGE_ROW):
        for x in range(IMAGE_COLUMN):
            fn = image_names[IMAGE_COLUMN * y + x]
            from_image = Image.open(IMAGES_PATH + fn)
            if IMAGE_SIZE[0] == 0:
                IMAGE_SIZE = from_image.size
                to_image = Image.new('RGBA', (IMAGE_COLUMN * IMAGE_SIZE[0], IMAGE_ROW * (offset + IMAGE_SIZE[1]))) #创建一个新图
                layer2 = Image.new('RGBA', (IMAGE_COLUMN * IMAGE_SIZE[0], IMAGE_ROW * (offset + IMAGE_SIZE[1])))
                draw = ImageDraw.Draw(layer2)

            # .resize((IMAGE_SIZE[0], IMAGE_SIZE[1]),Image.ANTIALIAS)
            pivot = (x * IMAGE_SIZE[0], y * (offset + IMAGE_SIZE[1]))
            to_image.paste(from_image, pivot)
            txt = re.sub('_.*', '', fn.removesuffix('.png'))
            draw.text((pivot[0] + IMAGE_SIZE[0] / 2 - len(txt) * fz / 3, pivot[1] + IMAGE_SIZE[1] + 20), txt, (0,0,0,255), font=font)

    return Image.alpha_composite(to_image, layer2).save(IMAGE_SAVE_PATH, format='PNG') # 保存新图
 
image_compose() #调用函数