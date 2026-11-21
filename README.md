# Xidian-ICTT-GZ.github.io
The Homepage of the ICTT Lab-Guangzhou, Xidian University

[https://xidian-ictt-gz.github.io](https://xidian-ictt-gz.github.io)

## 本地图廊

照片固定存放在 `imgs/student-gallery/`，该目录已加入 Git 忽略规则。从仓库根目录启动本地预览服务。首次使用请通过 `python3 -m pip install Pillow` 安装图片处理库。

```sh
python3 tools/student_gallery_server.py
```

打开终端显示的学生页地址。图廊会自动扫描固定目录及其子文件夹并生成缩略图。增删照片后，刷新页面即可更新。
