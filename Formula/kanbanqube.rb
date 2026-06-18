class Kanbanqube < Formula
  desc "Local-first Kanban board backed by normal files"
  homepage "https://github.com/mathiasconradt/kanbanqube"
  version "1.0.38"
  url "https://github.com/mathiasconradt/kanbanqube/releases/download/v#{version}/kanbanqube-#{version}.tgz"
  sha256 "3a8af7c8be8820d6c11a9c389cf9ef66b06b8975ccdd8f8947808095fe342d16"
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
