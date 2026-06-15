class Kanbanqube < Formula
  desc "Local-first Kanban board backed by normal files"
  homepage "https://github.com/mathiasconradt/kanbanqube"
  version "1.0.26"
  url "https://github.com/mathiasconradt/kanbanqube/releases/download/v#{version}/kanbanqube-#{version}.tgz"
  sha256 "a30082e34258d41e8969a25e382fbbeed2592aa32866b6f6a15de0fcb2f053fa"
  license "Apache-2.0"

  depends_on "node"

  def install
    app_root = buildpath/"package"
    libexec.install app_root.children
    bin.write_exec_script libexec/"server.js"
  end

  test do
    system bin/"kanbanqube", "--help"
  end
end
