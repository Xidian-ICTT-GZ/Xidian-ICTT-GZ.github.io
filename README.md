# Xidian-ICTT-GZ.github.io
The Homepage of the ICTT Lab-Guangzhou, Xidian University

[https://xidian-ictt-gz.github.io](https://xidian-ictt-gz.github.io)

## 学生页「团队影像」

### 更新线上图廊

把可公开的照片添加到 `imgs/student-gallery/`。可以使用子文件夹。删除或替换照片也在同一目录完成。随后在仓库根目录执行下面的命令。

```sh
python3 tools/publish_student_gallery.py
```

首次使用需为运行脚本的 Python 安装 Pillow（`python3 -m pip install Pillow`），并准备可在本仓库发布 Release 和运行 Actions 的 GitHub 登录。脚本优先使用当前环境中的 `GH_TOKEN` 或 `GITHUB_TOKEN`，也可以使用 Git 已保存的 HTTPS 登录凭据。

脚本会重新扫描目录，生成宽、高分别不超过 1200、900 像素的公开大图、640 × 480 缩略图和索引，再把它们打包成 `student-gallery.zip`，上传到带版本的 GitHub Release。随后脚本启动 GitHub Actions，校验并解包附件，部署到 [xidian.work 的团队成员页](https://xidian.work/students.html)。终端显示「线上图廊已更新」后刷新网页。若 Release 已发布但部署尚未完成，可去 [Actions](https://github.com/Xidian-ICTT-GZ/Xidian-ICTT-GZ.github.io/actions) 查看进度。若启动部署失败，在同一页面选择 `Deploy Xidian lab website` → `Run workflow`，使用 `main` 分支重新部署即可。

照片和本地缓存由 Git 忽略，更新照片无需提交代码或手工修改索引。每个 Release 都包含完整的公开图廊。浏览器按需加载缩略图，放大时加载公开大图。公开版会重新编码为静态 JPEG，本地原文件可继续保留。

### 本地更新与查看

1. **管理照片。** 在仓库里的 `imgs/student-gallery/` 中添加、删除或替换照片。可以用子文件夹分类，脚本会一并扫描。支持 JPEG、PNG、WebP、GIF 和 AVIF。图廊统一以 4:3 显示缩略图，点击照片可看原图。
2. **更新图廊。** 首次使用或每次增删、替换照片后，在终端进入仓库根目录（包含 `students.html` 的目录），执行下面的命令。

   ```sh
   python3 tools/update_student_gallery.py
   ```

   等终端显示「学生图廊已更新，共 N 张照片」。脚本会重新扫描目录，给新增或替换的照片生成缩略图，并重建索引。未更改照片的缩略图会从缓存复用。删除的照片会从索引中移除。
3. **打开学生页。** 在 Finder 或文件管理器里双击 `students.html`。如果页面已经打开，刷新一次。四行图廊可直接离线播放，鼠标悬停只暂停当前行。

照片和生成的 `imgs/student-gallery/.gallery-cache/` 都由 Git 忽略。新检出仓库时，先把照片复制到固定目录，再运行更新命令。macOS 可用系统自带的 `sips` 生成缩略图，其他系统可用 `python3 -m pip install Pillow` 获得缩略图支持。

每次打开或刷新页面，图廊都会随机打乱照片并均匀分配到各行。每张照片只分配到一行，各行使用相同的循环周期，相邻行反向滚动。照片充足时，图廊会铺开到较宽的展示区。照片较少时，同一张照片可能在一行的两端各露出一部分。照片少于八张时，页面会减少行数，让每条滚动行至少有两张照片。

### 黑图修复与排查

此前有 16 张原图能正常打开，但 macOS 的 `sips` 直接缩放其中的 JPEG 时生成了全黑缩略图。更新脚本现在会先重新编码 JPEG，再缩放。这个处理自动用于后续新增的 JPEG，原图仍保留在照片目录里。修复时也升级了缩略图缓存版本，第一次运行会重建缩略图，避开旧缓存。

如果本地预览仍看到黑图，可按下面的顺序排查。

1. 点击照片并选择「查看大图」。如果本地原图也发黑或打不开，换一份能正常打开的原图，再运行更新命令。
2. 如果原图正常，先执行更新命令并刷新。若缩略图仍发黑，把 `imgs/student-gallery/.gallery-cache/` 改名为 `.gallery-cache-backup/`，再运行更新命令，让脚本从头生成缓存。
3. 如果重建后只有个别照片仍发黑，可把那张原图重新导出为普通 sRGB JPEG，放回照片目录后再次更新。

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
