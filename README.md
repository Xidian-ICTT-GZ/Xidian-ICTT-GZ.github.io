# Xidian-ICTT-GZ.github.io
The Homepage of the ICTT Lab-Guangzhou, Xidian University

[https://xidian-ictt-gz.github.io](https://xidian-ictt-gz.github.io)

## 学生页「团队影像」

### 日常更新与查看

1. **管理照片。** 在仓库里的 `imgs/student-gallery/` 中添加、删除或替换照片。可以用子文件夹分类，脚本会一并扫描。支持 JPEG、PNG、WebP、GIF 和 AVIF。图廊统一以 4:3 显示缩略图，点击照片可看原图。
2. **更新图廊。** 首次使用或每次增删、替换照片后，在终端进入仓库根目录（包含 `students.html` 的目录），执行下面的命令。

   ```sh
   python3 tools/update_student_gallery.py
   ```

   终端会显示扫描到的照片数量。脚本会自动生成文件索引和缩略图，照片文件名由扫描结果决定。
3. **打开学生页。** 在 Finder 或文件管理器里双击 `students.html`。如果页面已经打开，刷新一次。三行图廊可直接离线播放，鼠标悬停只暂停当前行。

照片和生成的 `imgs/student-gallery/.gallery-cache/` 都由 Git 忽略。新检出仓库时，先把照片复制到固定目录，再运行更新命令。macOS 可用系统自带的 `sips` 生成缩略图，其他系统可用 `python3 -m pip install Pillow` 获得缩略图支持。

每次打开或刷新页面，图廊都会随机打乱照片并均匀分配到各行。每张照片只分配到一行，各行使用相同的循环周期。照片充足时，图廊会铺开到较宽的展示区。照片较少时，同一张照片可能在一行的两端各露出一部分。照片少于六张时，页面会减少行数，让每条滚动行至少有两张照片。

### 常见情况

- 页面提示「请运行 tools/update_student_gallery.py 生成本地照片索引」时，执行上面的更新命令，再刷新页面。
- 新照片未出现时，先确认照片位于固定目录或其子目录内，再检查更新命令输出的照片数量。
- 右上角显示「播放轮播」时，点击即可开始。系统开启「减弱动态效果」时，图廊默认等待手动播放。

### 可选的本地预览服务

如果要在每次刷新时实时扫描照片，可安装 Pillow 后从仓库根目录启动预览服务。

```sh
python3 tools/student_gallery_server.py
```

在浏览器打开终端显示的地址。
