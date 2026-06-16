class Kanbanqube < Formula
  desc "Local-first Kanban board backed by normal files"
  homepage "https://github.com/mathiasconradt/kanbanqube"
  version "1.0.33"
  url "https://github.com/mathiasconradt/kanbanqube/releases/download/v#{version}/kanbanqube-#{version}.tgz"
  sha256 "7fb23a4b331d23735cd6ec5ec31810996e39d31f432a612b2b0a97e2c046dc71"
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
