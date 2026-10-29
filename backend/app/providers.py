"""Deterministic, key-free narrative composition and honest provider boundaries."""

import json
from pathlib import Path
from typing import Protocol

from .schemas import AssetRequest, Draft


TEMPLATES = [
    {
        "id": "old-home", "title": "家的模样", "subtitle": "2005 年夏天，奶奶家的下午",
        "description": "从旧电视、红色布娃娃与家庭照片里，找回一个平凡的下午。",
        "scenePreset": "old-home-summer", "sceneStatus": "fully-playable",
        "duration": "约 5 分钟", "anchors": ["tv", "doll", "photo"],
    },
    {
        "id": "station", "title": "那年，我们选择远方", "subtitle": "站台上的一次告别",
        "description": "穿过候车大厅与站台，登上那节承载告别的绿皮车。",
        "scenePreset": "railway-station", "sceneStatus": "fully-playable",
        "duration": "约 5 分钟", "anchors": ["tv", "doll", "photo"],
    },
    {
        "id": "classroom", "title": "青春里没说出口的话", "subtitle": "写给青春的一封信",
        "description": "走过教室与阳光走廊，找回课桌上没递出的纸条。",
        "scenePreset": "sunlit-classroom", "sceneStatus": "fully-playable",
        "duration": "约 5 分钟", "anchors": ["tv", "doll", "photo"],
    },
]


class StoryProvider(Protocol):
    def compose(self, draft: Draft) -> dict: ...


class DemoStoryProvider:
    """Uses confirmed fields verbatim, and labels authored possibilities as imagination."""

    def compose(self, draft: Draft) -> dict:
        d = draft
        template = next(t for t in TEMPLATES if t["id"] == d.templateId)
        demo = d.model_dump() == {
            "templateId": "old-home", "year": "2005", "place": "奶奶家的客厅",
            "importantPerson": "奶奶", "importantObject": "红色布娃娃",
            "storyText": "暑假的下午，奶奶在厨房忙，我抱着她做的布娃娃看电视。窗外有蝉鸣，阳光落在地板上。傍晚，我要和父母回自己家。",
            "actualChoice": "傍晚和父母离开，向奶奶挥手告别。",
        }
        if demo:
            anchors = [
                {"id": "tv", "assetId": "old-tv", "narration": "电视里传来熟悉的片头曲。你已经忘记那一集讲了什么，却还记得厨房里碗筷的轻响，和奶奶叫你吃西瓜的声音。\n\n这是一段预置示例故事，可以在讲述页改成你自己的回忆。"},
                {"id": "doll", "assetId": "red-doll", "narration": "它的一只眼睛是黑纽扣，另一只总有些歪。奶奶说，这样才认得出来是给我做的。\n\n许多年过去，手心好像还记得那块布料的触感。（预置示例）"},
                {"id": "photo", "assetId": "family-frame", "narration": "照片里的我们都看着镜头。只有窗外的树，像还在那年夏天轻轻摇晃。\n\n那时没有人觉得，这个普通的下午值得特别记住。（预置示例）"},
            ]
        else:
            # Atmospheric objects are framing devices, never claims of inferred personal facts.
            anchors = [
                {"id": "tv", "assetId": "old-tv", "narration": f"你讲述的那一天：\n“{d.storyText}”\n\n屏幕的微光只是这间模板房间的布景。真实的声音，留给你自己的记忆。"},
                {"id": "doll", "assetId": "red-doll", "narration": f"你想珍藏的物件是：{d.importantObject}。\n\n这里的红色布娃娃是它的象征替身，不是原物的真实复原。你与{d.importantPerson}的细节，以你讲述的内容为准。"},
                {"id": "photo", "assetId": "family-frame", "narration": f"{d.year}，{d.place}。\n\n你记得的重要的人是{d.importantPerson}。相框中的插画是模板画面，不是你的家庭照片。没有讲过的事情，我们不替你补写。"},
            ]
        if d.templateId == "station":
            anchors = [
                {"id": "tv", "assetId": "departure-board", "narration": f"时刻表还亮着。等待的时间，往往比行程本身更让人记得。\n\n你讲述的那一天：“{d.storyText}”\n\n这是一处艺术化车站，真正的声音与细节，以你确认的记忆为准。"},
                {"id": "doll", "assetId": "leather-suitcase", "narration": f"你想珍藏的是“{d.importantObject}”。行囊可以承载对远方的期待，也可以成为你与{d.importantPerson}之间牵挂的象征。\n\n这件模型是记忆的象征，细节由你的讲述决定。"},
                {"id": "photo", "assetId": "paper-ticket", "narration": f"{d.year}，{d.place}。车票上的起点和终点，像人生中一个小小的坐标。\n\n你确认的重要的人是{d.importantPerson}。票面与站名只是场景布景，不是对真实车票的复原。"},
            ]
        elif d.templateId == "classroom":
            anchors = [
                {"id": "tv", "assetId": "graduation-board", "narration": f"黑板上的字还没有被擦去。你讲述的那一天：“{d.storyText}”\n\n这间教室承载你的讲述，不替你添加未说过的过去。"},
                {"id": "doll", "assetId": "folded-letter", "narration": f"“{d.importantObject}”静静留在课桌上。有些心意，在当时很难说出口，过了很多年仍然记得。\n\n你与{d.importantPerson}的故事，以你确认的内容为准。"},
                {"id": "photo", "assetId": "class-yearbook", "narration": f"{d.year}，{d.place}。纪念册把许多普通的日子装订在一起。\n\n关于{d.importantPerson}的每一页，都留给你自己确认。封面上的文字是虚构布景。"},
            ]
        imagined = {
            "old-home": [f"你在门边停了一下，转身问{d.importantPerson}：“可以再陪我坐一会儿吗？”", "屋里的光慢慢暖起来。两只茶杯被放到桌上，留出一个可以从容说话的下午。", "这是今天为自己写下的一种可能。它不会替代已经走过的路，也不意味着另一条路一定更好。"],
            "station": [f"如果在告别前多留一分钟，你会想对{d.importantPerson}说些什么？", "想象中，你放慢脚步，把那句还没说完的话说完。去或留，都不需要用一个假设来判定对错。", "这一段是今天的创作，并不是过去真的发生过的事。"],
            "classroom": [f"想象你又遇见{d.importantPerson}，可以从一句简单的“谢谢你”开始。", "你把想说的话写在纸上，放到桌子另一边。窗外的光停留了一会儿，故事允许你慢一点。", "这是一个温柔的假设，不是真实历史，也不是对未来的预测。"],
        }
        return {
            "mode": "template-demo", "templateId": d.templateId,
            "scenePreset": template["scenePreset"], "title": f"{d.year} · {d.place}",
            "facts": {"year": d.year, "place": d.place, "person": d.importantPerson, "object": d.importantObject, "actualChoice": d.actualChoice},
            "anchors": anchors,
            "decision": {
                "question": "如果能回去一小会儿，你想怎样度过？",
                "real": {"label": "重温真实路线", "script": [f"你确认的经历是：{d.actualChoice}。", f"你曾这样讲述：{d.storyText}", "那一天已经过去。我们把你确认的部分原样留下，也给没有讲述的部分留白。"]},
                "imagined": {"label": "多留一个下午" if d.templateId == "old-home" else "把想说的话说完", "disclaimer": "AI 想象 · 并非真实历史（本版由本地叙事模板创作）", "script": imagined[d.templateId]},
            },
            "letterPrompt": "写给那时的自己，也可以写给重要的人。",
            "ending": "回忆无法重来，但爱可以被重新看见。",
        }


class GenerationDisabled(Exception):
    pass


class AssetProvider(Protocol):
    def list_assets(self) -> list[dict]: ...
    def create_job(self, request: AssetRequest, idempotency_key: str) -> dict: ...
    def get_job(self, job_id: str) -> dict: ...


class LocalAssetProvider:
    def __init__(self, manifest_path: Path):
        self.manifest_path = manifest_path

    def list_assets(self) -> list[dict]:
        if not self.manifest_path.is_file():
            return []
        manifest = json.loads(self.manifest_path.read_text(encoding="utf-8-sig"))
        return manifest if isinstance(manifest, list) else manifest.get("assets", [])

    def create_job(self, request: AssetRequest, idempotency_key: str) -> dict:
        raise GenerationDisabled("当前版本仅复用本地资产，不创建生成任务，也不消费额度。")

    def get_job(self, job_id: str) -> dict:
        raise GenerationDisabled("当前版本未启用生成任务。")


class Lux3DProvider:
    """Deliberately disabled until a separately authorized, documented real integration."""

    def create_job(self, request: AssetRequest, idempotency_key: str) -> dict:
        raise GenerationDisabled("Lux3D 未接入。启用前需核对官方国内 API、用户授权与预算。")

    def get_job(self, job_id: str) -> dict:
        raise GenerationDisabled("Lux3D 未接入；不存在真实供应商任务。")
