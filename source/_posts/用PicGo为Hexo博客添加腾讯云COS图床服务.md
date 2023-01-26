---
title: 用PicGo为Hexo博客添加腾讯云COS图床服务
categories: 技术
tags: [博客]
toc: true
date: 2023-01-26 15:11:24
---

有个在线图床还是要舒服很多的！

<!-- more -->

## PicGo

[PicGo](https://picgo.github.io/PicGo-Doc/zh/guide/)是开源免费的图片上传和管理工具，可以快速将图片保存到第三方服务，并自动生成剪贴板链接。

### 下载

下载最新正式版[安装包](https://github.com/Molunerfinn/PicGo)并安装完毕。

## 腾讯云 COS

[腾讯云 COS](https://cloud.tencent.com/act/pro/cos#%E6%96%B0%E7%94%A8%E6%88%B7%E4%B8%93%E4%BA%AB%E7%A4%BC%E5%8C%85)

### 购买 COS 服务并创建桶

购买 COS 后，进入控制台创建存储桶，基本填写如下：
![](https://mdreame-1315121834.cos.ap-hongkong.myqcloud.com/markdown-img/202301261521489.png)

后续配置依个人情况选择。创建成功后，需要新建密钥，获取`SecretId`、`SecretKey`、`APPID`以及存储桶信息。

### 在 PicGo 中配置腾讯云服务

回到 PicGo`图床设置`--`腾讯云COS`，将上述信息依次填入。

![](https://mdreame-1315121834.cos.ap-hongkong.myqcloud.com/markdown-img/202301261532030.png)

## 参考

-   [使用 PicGo+腾讯云对象存储 COS 作为图床](https://zhuanlan.zhihu.com/p/119250383)
-   [使用 GitHub 作为 PicGo 图床](https://zhuanlan.zhihu.com/p/489236769)
-   [GitHub+picGo+CDN 搭建免费图床](https://zhuanlan.zhihu.com/p/350598351)
-   [GitHub+PicGo+Typora](https://zhuanlan.zhihu.com/p/489236769)
